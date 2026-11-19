import { PrismaClient } from '@prisma/client';
import { upsertPowerFitPublicContent } from '../src/public-content.js';

const db = new PrismaClient();

upsertPowerFitPublicContent(db)
  .then(() => console.log('Catálogo público de POWER FIT actualizado.'))
  .finally(() => db.$disconnect());
