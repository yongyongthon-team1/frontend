import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist',
      'public/mockServiceWorker.js',
      'playwright-report',
      'test-results',
      '.claude/**',
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs['recommended-latest'].rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['playwright.config.ts', 'vite.config.ts', 'middleware.ts'],
    languageOptions: { globals: globals.node },
  },
  {
    // 데이터 생성 스크립트(Node, 의존성 없음)
    extends: [js.configs.recommended],
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'module', globals: globals.node },
  },
  {
    files: ['src/pages/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/lib/http', '@/features/*/api'],
              message: '화면은 features/*/queries.ts 훅만 쓴다 (설계 5.2)',
            },
          ],
        },
      ],
    },
  },
);
