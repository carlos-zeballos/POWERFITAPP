// Postgres local sin Docker (Windows/macOS/Linux). Usa los binarios de embedded-postgres vía pg_ctl,
// que soporta cuentas de administrador en Windows. Mismas credenciales que docker-compose.
import EmbeddedPostgres from 'embedded-postgres';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';

const dir = './.pgdata';
const cmd = process.argv[2] ?? 'start';
if (!existsSync(dir))
  await new EmbeddedPostgres({ databaseDir: dir, user: 'powerfit', password: 'powerfit', port: 5432 }).initialise();
const pkg = `@embedded-postgres/${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
const bin = join('node_modules', pkg, 'native', 'bin', 'pg_ctl');
execFileSync(
  bin,
  cmd === 'stop' ? ['-D', dir, 'stop'] : ['-D', dir, '-o', '-p 5432', '-l', join(dir, 'server.log'), '-w', 'start'],
  { stdio: 'ignore' },
);
console.log(cmd === 'stop' ? 'Postgres detenido' : 'Postgres listo en :5432 (logs en .pgdata/server.log)');
