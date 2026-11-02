import { execSync } from 'node:child_process';
// BD de pruebas migrada + semilla (la semilla vacía las tablas) ficticia en cada corrida.
export default function () {
  const env = { ...process.env, DATABASE_URL: 'postgresql://powerfit:powerfit@localhost:5432/powerfit_test' };
  execSync('npx prisma migrate deploy', { env, stdio: 'ignore' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'ignore' });
}
