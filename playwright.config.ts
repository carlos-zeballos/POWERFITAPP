import { defineConfig } from '@playwright/test';
const DATABASE_URL = 'postgresql://powerfit:powerfit@localhost:5432/powerfit_test';
// Requiere: Postgres arriba (npm run db:local o docker compose up -d) y `npm run build -w apps/web`.
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/setup.ts',
  workers: 1,
  use: { baseURL: 'http://localhost:4100', locale: 'es-PE', timezoneId: 'America/Lima' },
  projects: [
    { name: 'm360', use: { viewport: { width: 360, height: 780 }, hasTouch: true, isMobile: true } },
    { name: 't768', use: { viewport: { width: 768, height: 1024 }, hasTouch: true } },
    { name: 'd1280', use: { viewport: { width: 1280, height: 800 } } },
  ],
  webServer: {
    command: 'npx tsx --env-file=.env apps/api/src/index.ts',
    url: 'http://localhost:4100/api/v1/health',
    env: { DATABASE_URL, PORT: '4100', NODE_ENV: 'test', CORS_ORIGIN: 'http://localhost:4100' },
    reuseExistingServer: false,
  },
});
