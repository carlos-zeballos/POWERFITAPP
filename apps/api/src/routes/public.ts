import { Router } from 'express';
import { db } from '../db.js';

export const publicSite = Router();

/** No session is required: this is the single commercial catalog consumed by the public site. */
publicSite.get('/public/catalog', async (_req, res) => {
  const [plans, hours] = await Promise.all([
    db.plan.findMany({
      where: { active: true, publicVisible: true },
      orderBy: { sortOrder: 'asc' },
    }),
    db.openingHour.findMany({ orderBy: { sortOrder: 'asc' } }),
  ]);
  res.json({ plans, hours });
});
