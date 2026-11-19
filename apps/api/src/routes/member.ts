import { Router } from 'express';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { membersWithStatus } from './staff.js';
import { iso } from '../dates.js';

export const member = Router();
const isMember = requireRole('MEMBER');

member.get('/me', isMember, async (req, res) => {
  const [m] = await membersWithStatus({ id: req.user.memberId });
  if (!m) return void res.status(404).json({ error: 'Socio no encontrado' });
  const history = await db.membership.findMany({
    where: { memberId: m.id },
    include: { plan: true },
    orderBy: { startDate: 'desc' },
  });
  res.json({
    fullName: m.fullName,
    membership: m.membership,
    nextMembership: m.nextMembership,
    memberships: history.map((entry) => ({
      id: entry.id,
      plan: entry.plan.name,
      startDate: iso(entry.startDate),
      endDate: iso(entry.endDate),
      registeredAt: entry.createdAt,
    })),
  });
});

member.get('/me/notices', isMember, async (req, res) => {
  res.json(
    await db.notice.findMany({
      where: { memberId: req.user.memberId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, kind: true, title: true, body: true, createdAt: true, readAt: true },
    }),
  );
});

member.post('/me/notices/:id/read', isMember, async (req, res) => {
  await db.notice.updateMany({
    where: { id: req.params.id as string, memberId: req.user.memberId, readAt: null },
    data: { readAt: new Date() },
  });
  res.status(204).end();
});
