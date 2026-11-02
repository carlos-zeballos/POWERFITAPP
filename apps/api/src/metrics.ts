import type { RequestHandler } from 'express';
import { appendFile, mkdir } from 'node:fs/promises';

// shortcut: buffer en memoria (se pierde al reiniciar); el histórico queda en logs/metrics.log (JSONL).
const buf: number[] = [];
await mkdir('logs', { recursive: true });

export const metrics: RequestHandler = (req, res, next) => {
  const t = performance.now();
  res.on('finish', () => {
    const ms = Math.round(performance.now() - t);
    buf.push(ms);
    if (buf.length > 1000) buf.shift();
    if (process.env.NODE_ENV !== 'test')
      appendFile('logs/metrics.log', JSON.stringify({ at: new Date().toISOString(), m: req.method, p: req.path, s: res.statusCode, ms }) + '\n').catch(() => {});
  });
  next();
};

export function p95() {
  if (!buf.length) return null;
  const s = [...buf].sort((a, b) => a - b);
  return s[Math.floor(s.length * 0.95)];
}
