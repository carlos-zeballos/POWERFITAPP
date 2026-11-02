import { defineConfig } from 'vitest/config';
const DATABASE_URL = 'postgresql://powerfit:powerfit@localhost:5432/powerfit_test';
export default defineConfig({
  test: { env: { DATABASE_URL, NODE_ENV: 'test' }, globalSetup: './test/setup.ts', fileParallelism: false },
});
