import express, { type ErrorRequestHandler } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { loyalty } from './routes/loyalty.js';
import { publicSite } from './routes/public.js';
import { loyaltyEnabled } from './loyalty.js';

export const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        'font-src': ["'self'", 'https://fonts.gstatic.com'],
        'frame-src': ['https://www.google.com'],
        'img-src': ["'self'", 'data:'],
      },
    },
  }),
  cors({ origin: (process.env.CORS_ORIGIN ?? '').split(','), credentials: true }),
  express.json({ limit: '50kb' }),
  cookieParser(),
  metrics,
);
app.use(
  '/api',
  rateLimit({
    windowMs: 60_000,
    limit: process.env.NODE_ENV === 'test' ? 10_000 : 300,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

app.get('/api/v1/health', (_req, res) => res.json({ ok: true }));
app.get('/api/v1/features', (_req, res) => res.json({ loyalty: loyaltyEnabled() }));
app.use('/api/v1/auth', auth);
app.use('/api/v1', publicSite);
app.use('/api/v1', staff, member, owner);
app.use('/api/v1', loyalty);
app.use('/api', (_req, res) => res.status(404).json({ error: 'No encontrado' }));

// Producción en un solo proceso: la API sirve el build del frontend (mismo origen → cookies SameSite=Strict).
const dist = process.env.WEB_DIST ?? fileURLToPath(new URL('../../web/dist', import.meta.url));
if (existsSync(dist)) {
  const noCache = (p: string) => p.endsWith('.html') || p.endsWith('sw.js') || p.endsWith('.webmanifest');
  app.use(
    express.static(dist, {
      index: false,
      setHeaders: (res, p) =>
        res.setHeader(
          'Cache-Control',
          noCache(p)
            ? 'no-cache'
            : p.includes('assets')
              ? 'public, max-age=31536000, immutable'
              : 'public, max-age=86400',
        ),
    }),
  );
  app.get(/.*/, (_req, res) => res.setHeader('Cache-Control', 'no-cache').sendFile(join(dist, 'index.html')));
}

const onError: ErrorRequestHandler = (err, _req, res, next) => {
  void next;
  if (err instanceof ZodError) return void res.status(400).json({ error: err.issues[0]?.message ?? 'Datos inválidos' });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025')
    return void res.status(404).json({ error: 'No encontrado' });
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002')
    return void res.status(409).json({ error: 'Ya existe' });
  console.error(err);
  res.status(500).json({ error: 'Error interno' });
};
app.use(onError);
