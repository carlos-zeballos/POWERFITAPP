import { Router, type RequestHandler, type Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import type { Role } from '@prisma/client';
import { db } from './db.js';

const ACCESS = process.env.JWT_SECRET!;
const REFRESH = process.env.JWT_REFRESH_SECRET!;
if (!ACCESS || !REFRESH) throw new Error('JWT_SECRET y JWT_REFRESH_SECRET son obligatorios');

export type AuthUser = { id: string; role: Role; memberId?: string };
declare module 'express-serve-static-core' {
  interface Request {
    user: AuthUser;
  }
}

const secure = process.env.NODE_ENV === 'production';
const cookie = { httpOnly: true, sameSite: 'strict' as const, secure };

function issue(res: Response, u: { id: string; role: Role; tokenVersion: number; member?: { id: string } | null }) {
  const payload: AuthUser = { id: u.id, role: u.role, memberId: u.member?.id };
  res.cookie('at', jwt.sign(payload, ACCESS, { expiresIn: '15m' }), { ...cookie, maxAge: 15 * 60_000 });
  res.cookie('rt', jwt.sign({ id: u.id, v: u.tokenVersion }, REFRESH, { expiresIn: '30d' }), {
    ...cookie,
    path: '/api/v1/auth',
    maxAge: 30 * 86_400_000,
  });
  return payload;
}

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, res, next) => {
    try {
      const u = jwt.verify(req.cookies?.at ?? '', ACCESS) as AuthUser;
      if (!roles.includes(u.role)) return void res.status(403).json({ error: 'Sin permiso' });
      req.user = u;
      next();
    } catch {
      res.status(401).json({ error: 'Sesión expirada' });
    }
  };

export const auth = Router();
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiados intentos, espera 15 minutos' },
});

auth.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = z
    .object({ email: z.string().email().toLowerCase(), password: z.string().min(1).max(200) })
    .parse(req.body);
  const u = await db.user.findUnique({ where: { email }, include: { member: { select: { id: true } } } });
  if (!u || !(await bcrypt.compare(password, u.passwordHash)))
    return void res.status(401).json({ error: 'Correo o contraseña incorrectos' });
  res.json({ ...issue(res, u), name: u.name });
});

auth.post('/refresh', async (req, res) => {
  try {
    const t = jwt.verify(req.cookies?.rt ?? '', REFRESH) as { id: string; v: number };
    const u = await db.user.findUnique({ where: { id: t.id }, include: { member: { select: { id: true } } } });
    if (!u || u.tokenVersion !== t.v) throw new Error();
    res.json({ ...issue(res, u), name: u.name });
  } catch {
    res.status(401).json({ error: 'Sesión expirada' });
  }
});

auth.post('/logout', async (req, res) => {
  try {
    const t = jwt.verify(req.cookies?.rt ?? '', REFRESH) as { id: string };
    await db.user.update({ where: { id: t.id }, data: { tokenVersion: { increment: 1 } } }); // revoca refresh en todos los dispositivos
  } catch {
    /* sesión ya inválida */
  }
  res.clearCookie('at').clearCookie('rt', { path: '/api/v1/auth' }).status(204).end();
});

auth.get('/me', requireRole('OWNER', 'STAFF', 'MEMBER'), async (req, res) => {
  const u = await db.user.findUniqueOrThrow({
    where: { id: req.user.id },
    select: { name: true, email: true, role: true },
  });
  res.json({ ...req.user, ...u });
});
