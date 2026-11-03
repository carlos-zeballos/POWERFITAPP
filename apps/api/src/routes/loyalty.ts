import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireRole } from '../auth.js';
import { db } from '../db.js';
import { daysLeft, iso, today } from '../dates.js';
import { loyaltyEnabled } from '../loyalty.js';
import { loyaltySettings, recalculateStreak } from '../streaks.js';

export const loyalty = Router();
const staff = requireRole('OWNER', 'STAFF');
const member = requireRole('MEMBER');
const checkinLimit = rateLimit({
  windowMs: 60_000,
  limit: process.env.NODE_ENV === 'test' ? 10_000 : 60,
  standardHeaders: true,
  legacyHeaders: false,
});
const invalidCodes = new Map<string, { count: number; until: number }>();

loyalty.use((_req, res, next) => (loyaltyEnabled() ? next() : res.status(404).json({ error: 'No encontrado' })));

const qrSecret = () => process.env.LOYALTY_QR_SECRET ?? process.env.JWT_SECRET!;
const alias = z
  .string()
  .trim()
  .min(3)
  .max(24)
  .regex(/^[\p{L}\p{N} _-]+$/u, 'Alias inválido');

async function eligibleMembership(memberId: string, ref = today()) {
  return db.membership.findFirst({
    where: { memberId, cancelledAt: null, startDate: { lte: ref }, endDate: { gte: ref } },
    orderBy: { endDate: 'desc' },
    include: { plan: true },
  });
}

async function requireEligibleMember(memberId: string, ref = today()) {
  const [m, membership] = await Promise.all([
    db.member.findUnique({ where: { id: memberId }, select: { id: true, fullName: true, loyaltyConsentAt: true } }),
    eligibleMembership(memberId, ref),
  ]);
  if (!m) return { error: 'Socio no encontrado' } as const;
  if (!m.loyaltyConsentAt) return { error: 'El socio no autorizó fidelización' } as const;
  if (!membership) return { error: 'La membresía no permite registrar asistencia' } as const;
  return { member: m, membership } as const;
}

loyalty.post('/loyalty/consent', member, async (req, res) => {
  const body = z.object({ alias: alias.optional() }).parse(req.body ?? {});
  await db.member.update({
    where: { id: req.user.memberId },
    data: { loyaltyConsentAt: new Date(), loyaltyAlias: body.alias },
  });
  res.status(204).end();
});

loyalty.get('/loyalty/qr', member, async (req, res) => {
  const result = await requireEligibleMember(req.user.memberId!);
  if ('error' in result) return void res.status(409).json(result);
  const token = jwt.sign({ purpose: 'loyalty-checkin', memberId: result.member.id }, qrSecret(), { expiresIn: '60s' });
  res.json({ token, expiresInSeconds: 60 });
});

loyalty.get('/loyalty/members', staff, async (req, res) => {
  const { q } = z.object({ q: z.string().trim().min(2).max(60) }).parse(req.query);
  const rows = await db.member.findMany({
    where: {
      loyaltyConsentAt: { not: null },
      OR: [{ fullName: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }],
    },
    orderBy: { fullName: 'asc' },
    take: 20,
    select: { id: true, fullName: true, loyaltyAlias: true },
  });
  res.json(rows);
});

const checkinBody = z
  .object({
    memberId: z.string().optional(),
    qrToken: z.string().min(20).max(2000).optional(),
    code: z
      .string()
      .regex(/^\d{4}$/)
      .optional(),
  })
  .refine((b) => [b.memberId, b.qrToken, b.code].filter(Boolean).length === 1, 'Indica un socio, código o QR');

async function memberIdFromCheckin(body: z.infer<typeof checkinBody>) {
  if (body.memberId) return body.memberId;
  if (body.code) {
    const found = await db.member.findUnique({ where: { attendanceCode: body.code }, select: { id: true } });
    if (!found) throw new Error('Código no válido');
    return found.id;
  }
  const token = jwt.verify(body.qrToken!, qrSecret()) as { purpose?: string; memberId?: string };
  if (token.purpose !== 'loyalty-checkin' || !token.memberId) throw new Error('QR no válido');
  return token.memberId;
}

loyalty.post('/loyalty/check-ins', staff, checkinLimit, async (req, res) => {
  const requester = req.ip ?? 'unknown';
  const attempt = invalidCodes.get(requester);
  if ((attempt?.until ?? 0) > Date.now())
    return void res.status(429).json({ error: 'Demasiados códigos inválidos. Intenta en 5 minutos.' });
  const body = checkinBody.safeParse(req.body ?? {});
  if (!body.success) return void res.status(400).json({ error: 'Código o QR no válido' });
  let memberId: string;
  try {
    memberId = await memberIdFromCheckin(body.data);
  } catch {
    const count = (attempt?.count ?? 0) + 1;
    invalidCodes.set(requester, { count, until: count >= 5 ? Date.now() + 5 * 60_000 : 0 });
    return void res.status(400).json({ error: 'QR no válido' });
  }
  invalidCodes.delete(requester);
  const day = today();
  const eligible = await requireEligibleMember(memberId, day);
  if ('error' in eligible) return void res.status(409).json(eligible);
  const source = body.data.qrToken ? 'QR' : 'MANUAL';
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.attendance.findUnique({
        where: { memberId_attendedOn: { memberId, attendedOn: day } },
      });
      if (existing) return { attendance: existing, created: false, pointsAwarded: 0 };
      const attendance = await tx.attendance.create({
        data: { memberId, attendedOn: day, source, createdById: req.user.id },
      });
      await tx.attendanceAudit.create({
        data: { attendanceId: attendance.id, action: 'CREATED', actorId: req.user.id },
      });
      const rule = await tx.pointRule.findUnique({ where: { key: 'attendance' } });
      const pointsAwarded = rule?.active ? rule.points : 0;
      if (pointsAwarded)
        await tx.pointLedger.create({
          data: {
            memberId,
            type: 'ATTENDANCE',
            amount: pointsAwarded,
            reason: String((rule!.metadata as { label?: string } | null)?.label ?? 'Asistencia diaria'),
            referenceId: attendance.id,
            sourceKey: `attendance:${attendance.id}`,
            createdById: req.user.id,
          },
        });
      return { attendance, created: true, pointsAwarded };
    });
    const [streak, balance] = await Promise.all([
      recalculateStreak(memberId),
      db.pointLedger.aggregate({ where: { memberId }, _sum: { amount: true } }),
    ]);
    const week = streak.weeks.at(-1);
    res.status(result.created ? 201 : 200).json({
      ...result,
      attendedOn: iso(result.attendance.attendedOn),
      member: eligible.member.fullName,
      plan: eligible.membership.plan.name,
      daysLeft: daysLeft(eligible.membership.endDate, day),
      streakWeeks: streak.currentWeeks,
      weekAttendance: week?.attendanceCount ?? 0,
      weeklyGoal: (await loyaltySettings()).weeklyGoal,
      pointsBalance: balance._sum.amount ?? 0,
      renewalWarning: daysLeft(eligible.membership.endDate, day) <= 7,
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
    const attendance = await db.attendance.findUniqueOrThrow({
      where: { memberId_attendedOn: { memberId, attendedOn: day } },
    });
    res.json({
      attendance: { ...attendance, attendedOn: iso(attendance.attendedOn) },
      created: false,
      pointsAwarded: 0,
      member: eligible.member.fullName,
    });
  }
});

loyalty.get('/loyalty/me', member, async (req, res) => {
  const result = await requireEligibleMember(req.user.memberId!);
  if ('error' in result) return void res.status(409).json(result);
  const [streak, points] = await Promise.all([
    recalculateStreak(result.member.id),
    db.pointLedger.aggregate({ where: { memberId: result.member.id }, _sum: { amount: true } }),
  ]);
  res.json({ streak, points: points._sum.amount ?? 0 });
});

const correction = z.object({ attendedOn: z.string().date().optional(), reason: z.string().trim().min(3).max(240) });

loyalty.patch('/loyalty/attendances/:id', staff, async (req, res) => {
  const body = correction.parse(req.body);
  const attendance = await db.attendance.findUniqueOrThrow({ where: { id: req.params.id as string } });
  const nextDay = body.attendedOn ? new Date(body.attendedOn) : attendance.attendedOn;
  const updated = await db.$transaction(async (tx) => {
    if (nextDay.getTime() !== attendance.attendedOn.getTime()) {
      const duplicate = await tx.attendance.findUnique({
        where: { memberId_attendedOn: { memberId: attendance.memberId, attendedOn: nextDay } },
      });
      if (duplicate) throw new Error('Ya existe asistencia para ese día');
    }
    const result = await tx.attendance.update({ where: { id: attendance.id }, data: { attendedOn: nextDay } });
    await tx.attendanceAudit.create({
      data: {
        attendanceId: attendance.id,
        action: 'CORRECTED',
        reason: body.reason,
        beforeData: { attendedOn: iso(attendance.attendedOn) },
        afterData: { attendedOn: iso(nextDay) },
        actorId: req.user.id,
      },
    });
    return result;
  });
  res.json({ ...updated, attendedOn: iso(updated.attendedOn) });
});

loyalty.post('/loyalty/attendances/:id/void', staff, async (req, res) => {
  const { reason } = correction.pick({ reason: true }).parse(req.body);
  const attendance = await db.attendance.findUniqueOrThrow({ where: { id: req.params.id as string } });
  if (attendance.status === 'VOID') return void res.json({ ...attendance, attendedOn: iso(attendance.attendedOn) });
  const updated = await db.$transaction(async (tx) => {
    const result = await tx.attendance.update({
      where: { id: attendance.id },
      data: { status: 'VOID', voidedAt: new Date() },
    });
    await tx.attendanceAudit.create({
      data: { attendanceId: attendance.id, action: 'VOIDED', reason, actorId: req.user.id },
    });
    return result;
  });
  res.json({ ...updated, attendedOn: iso(updated.attendedOn) });
});

loyalty.get('/loyalty/check-ins/today', staff, async (_req, res) => {
  const rows = await db.attendance.findMany({
    where: { attendedOn: today() },
    orderBy: { checkedAt: 'desc' },
    take: 60,
    include: { member: { select: { fullName: true } } },
  });
  res.json(
    rows.map(({ member: m, attendedOn, ...row }) => ({ ...row, attendedOn: iso(attendedOn), member: m.fullName })),
  );
});
