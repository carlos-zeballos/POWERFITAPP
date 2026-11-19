import { PrismaClient } from '@prisma/client';
import { createMembershipMissions } from '../src/missions.js';

const db = new PrismaClient();
const memberships = await db.membership.findMany({ include: { plan: true } });
for (const membership of memberships) await createMembershipMissions(db, membership);
console.log(`Misiones creadas para ${memberships.length} suscripciones.`);
await db.$disconnect();
