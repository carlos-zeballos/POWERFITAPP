import express, { type ErrorRequestHandler } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { metrics } from './metrics.js';
import { auth } from './auth.js';
import { staff } from './routes/staff.js';
import { member } from './routes/member.js';
import { owner } from './routes/owner.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet(),
  cors({ origin: (process.env.CORS_ORIGIN ?? '').split(','), credentials: true }),
  express.json({ limit: '50kb' }),
  cookieParser(),
  metrics,
);
app.use('/api', rateLimit({ windowMs: 60_000, limit: process.env.NODE_ENV === 'test' ? 10_000 : 300, standardHeaders: true, legacyHeaders: false }));

app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
app.use('/api/v1/auth', auth);
app.use('/api/v1', staff, member, owner);
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));

const onError: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) return void res.status(400).json({ error: err.issues[0]?.message ?? 'Datos inválidos' });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') return void res.status(404).json({ error: 'No encontrado' });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') return void res.status(409).json({ error: 'Ya existe' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
};
app.use(onError);
