// Datos 100 % ficticios y anónimos. Credenciales demo: ver README.
import { PrismaClient, type NoticeKind } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import gym from '../../web/src/config/gym.json' with { type: 'json' };
import { addDays, today } from '../src/dates.js';

const db = new PrismaClient();
const NOMBRES = [
  'Ana',
  'Luis',
  'Rosa',
  'Jorge',
  'Lucía',
  'Diego',
  'Carmen',
  'Raúl',
  'Elena',
  'Marco',
  'Sofía',
  'Iván',
  'Pilar',
  'Hugo',
  'Nadia',
  'Óscar',
];
const APELLIDOS = [
  'Quispe',
  'Mamani',
  'Flores',
  'Huamán',
  'Condori',
  'Vargas',
  'Rojas',
  'Chávez',
  'Torres',
  'Salas',
  'Paredes',
  'Ccama',
];
let seed = 42;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647; // determinista
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];

async function main() {
  await db.$transaction([
    db.redemption.deleteMany(),
    db.memberBadge.deleteMany(),
    db.pointLedger.deleteMany(),
    db.attendanceAudit.deleteMany(),
    db.attendance.deleteMany(),
    db.streakWeek.deleteMany(),
    db.streakState.deleteMany(),
    db.badge.deleteMany(),
    db.reward.deleteMany(),
    db.pointRule.deleteMany(),
    db.loyaltySettings.deleteMany(),
    db.notice.deleteMany(),
    db.broadcast.deleteMany(),
    db.pushSubscription.deleteMany(),
    db.membership.deleteMany(),
    db.member.deleteMany(),
    db.user.deleteMany(),
    db.plan.deleteMany(),
    db.manualHours.deleteMany(),
    db.baseline.deleteMany(),
    db.jobRun.deleteMany(),
  ]);
  const plans = await Promise.all(
    gym.planes.map((p) => db.plan.create({ data: { name: p.nombre, durationDays: p.dias, price: p.precio ?? 0 } })),
  );
  await db.loyaltySettings.create({ data: { id: 'default' } });
  await db.pointRule.createMany({
    data: [
      { key: 'attendance', points: 10, metadata: { label: 'Asistencia diaria' } },
      { key: 'weekly_goal', points: 25, metadata: { label: 'Meta semanal' } },
      { key: 'on_time_renewal', points: 50, metadata: { label: 'Renovación oportuna' } },
    ],
  });
  const hash = await bcrypt.hash('PowerFit2026!', 10);
  await db.user.create({
    data: { email: 'propietario@powerfit.test', name: 'Propietario Demo', role: 'OWNER', passwordHash: hash },
  });
  await db.user.create({
    data: { email: 'recepcion@powerfit.test', name: 'Recepción Demo', role: 'STAFF', passwordHash: hash },
  });
  const ref = today();
  const socio = await db.user.create({
    data: { email: 'socio@powerfit.test', name: 'Socio Demo', role: 'MEMBER', passwordHash: hash },
  });
  await db.member.create({
    data: {
      fullName: 'Socio Demo',
      phone: '900000001',
      consentAt: new Date(),
      userId: socio.id,
      memberships: { create: { planId: plans[0].id, startDate: addDays(ref, -22), endDate: addDays(ref, 7) } },
    },
  });

  const members = [],
    memberships = [],
    notices: {
      id: string;
      memberId: string;
      membershipId: string;
      kind: NoticeKind;
      title: string;
      body: string;
      createdAt: Date;
      pushedAt: Date | null;
    }[] = [];
  for (let i = 0; i < 479; i++) {
    const id = randomUUID();
    members.push({
      id,
      fullName: `${pick(NOMBRES)} ${pick(APELLIDOS)} ${String.fromCharCode(65 + (i % 26))}.`,
      phone: `9000${String(10000 + i).slice(-5)}`,
      consentAt: new Date(),
    });
    const plan = rnd() < 0.7 ? plans[0] : pick(plans);
    const end = addDays(ref, Math.floor(rnd() * 120) - 60);
    const prev = {
      id: randomUUID(),
      memberId: id,
      planId: plan.id,
      startDate: addDays(end, -plan.durationDays + 1),
      endDate: end,
      previousId: null as string | null,
      onTime: null as boolean | null,
      cancelledAt: null as Date | null,
    };
    memberships.push(prev);
    if (end < ref) {
      notices.push({
        id: randomUUID(),
        memberId: id,
        membershipId: prev.id,
        kind: 'D7',
        title: 'Tu membresía vence en 7 días',
        body: 'Aviso histórico (semilla).',
        createdAt: addDays(end, -7),
        pushedAt: rnd() < 0.52 ? addDays(end, -7) : null,
      });
      const r = rnd(); // distribución de la línea base: 38 % a tiempo, 26 % con retraso, 36 % no renueva
      if (r < 0.64) {
        const late = r >= 0.38;
        const start = late
          ? addDays(end, 1 + Math.floor(rnd() * Math.min(14, Math.max(1, ref.getTime() - end.getTime()) / 864e5)))
          : addDays(end, 1);
        if (start <= ref)
          memberships.push({
            id: randomUUID(),
            memberId: id,
            planId: plan.id,
            startDate: start,
            endDate: addDays(start, plan.durationDays - 1),
            previousId: prev.id,
            onTime: !late,
            cancelledAt: null,
          });
      } else if (rnd() < 0.3) prev.cancelledAt = addDays(end, 2);
    }
  }
  await db.member.createMany({ data: members });
  await db.membership.createMany({ data: memberships.filter((m) => !m.previousId) });
  await db.membership.createMany({ data: memberships.filter((m) => m.previousId) });
  await db.notice.createMany({ data: notices });
  await db.manualHours.createMany({
    data: [0, 1, 2, 3].map((w) => ({ weekStart: addDays(ref, -7 * (w + 1)), hours: 8 })),
  });
  await db.baseline.createMany({
    data: [
      { key: 'renovacionOportuna', value: 38, label: 'Renovación oportuna (%)' },
      { key: 'tasaBaja', value: 6.5, label: 'Tasa de baja mensual (%)' },
      { key: 'avisosOportunos', value: 52, label: 'Avisos oportunos (%)' },
      { key: 'horasControlManual', value: 8, label: 'Horas de control manual por semana' },
    ],
  });
  console.log(`Semilla: ${members.length + 1} socios, ${memberships.length + 1} membresías`);
}
main().finally(() => db.$disconnect());
