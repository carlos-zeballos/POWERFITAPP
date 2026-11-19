import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
export default tseslint.config(
  { ignores: ['**/dist', '.pgdata', 'apps/web/public/sw.js', 'playwright-report', 'test-results'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['apps/web/**/*.tsx'], plugins: { 'react-hooks': hooks }, rules: hooks.configs.recommended.rules },
  {
    files: ['scripts/**', 'apps/web/public/**'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        self: 'readonly',
        clients: 'readonly',
        caches: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        Response: 'readonly',
      },
    },
  },
);
