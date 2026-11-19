import { execSync } from 'node:child_process';
export default function () {
  const env = { ...process.env, DATABASE_URL: 'postgresql://powerfit:powerfit@localhost:5432/powerfit_test' };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore', cwd: 'apps/api' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore', cwd: 'apps/api' });
}
