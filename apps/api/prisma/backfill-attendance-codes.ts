import { PrismaClient } from '@prisma/client';
import { backfillAttendanceCodes } from '../src/attendance-code.js';

const db = new PrismaClient();
backfillAttendanceCodes(db)
  .then((count) => console.log(`Códigos asignados: ${count}`))
  .finally(() => db.$disconnect());
