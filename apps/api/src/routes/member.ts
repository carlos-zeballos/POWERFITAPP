import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { requireRole } from '../auth.js';
import { membersWithStatus } from './staff.js';

export const member = Router();
const isMember = requireRole('MEMBER');

member.get('/me', isMember, async (req, res) => {
  const [m] = await membersWithStatus({ id: req.user.memberId });
  if (!m) return void res.status(404).json({ error: 'Socio no encontrado' });
  res.json({ fullName: m.fullName, membership: m.membership });
});

member.get('/me/notices', isMember, async (req, res) => {
  res.json(await db.notice.findMany({ where: { memberId: req.user.memberId }, orderBy: { createdAt: 'desc' }, take: 50, select: { id: true, kind: true, title: true, body: true, createdAt: true, readAt: true } }));
});

member.post('/me/notices/:id/read', isMember, async (req, res) => {
  await db.notice.updateMany({ where: { id: req.params.id as string, memberId: req.user.memberId, readAt: null }, data: { readAt: new Date() } });
  res.status(204).end();
});

// Push: cualquier rol autenticado puede registrar su dispositivo.
member.get('/push/key', (_req, res) => res.json({ key: process.env.VAPID_PUBLIC_KEY ?? null }));
const sub = z.object({ endpoint: z.string().url().max(1000), keys: z.object({ p256dh: z.string().max(200), auth: z.string().max(100) }) });
member.post('/push/subscribe', requireRole('OWNER', 'STAFF', 'MEMBER'), async (req, res) => {
  const { endpoint, keys } = sub.parse(req.body);
  await db.pushSubscription.upsert({ where: { endpoint }, create: { endpoint, ...keys, userId: req.user.id }, update: { ...keys, userId: req.user.id } });
  res.status(204).end();
});
