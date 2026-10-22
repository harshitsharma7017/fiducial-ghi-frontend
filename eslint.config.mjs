// ESLint flat config: Next.js (core web vitals) plus type-aware typescript-eslint rules.
// ESLint stays on 9.x: the React, import and jsx-a11y plugins in eslint-config-next 16 do not
// support ESLint 10 yet.
import js from '@eslint/js';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier/flat';
import { defineConfig, globalIgnores } from 'eslint/config';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores([
    'node_modules/**',
    '.next/**',
    'out/**',
    'coverage/**',
    'next-env.d.ts',
    // Playwright output
    'test-results/**',
    'playwright-report/**',
    'blob-report/**',
  ]),

  js.configs.recommended,
  ...nextVitals,
  ...nextTypescript,

  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['**/*.{ts,tsx,mts,cts}'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-import-type-side-effects': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },

  // Sample data is reached only through the hooks in src/lib/api: components import from there,
  // never from src/lib/data. Swapping in the real API then touches one folder.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/lib/api/**', '**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/data', '@/lib/data/*', '**/lib/data', '**/lib/data/*'],
              message: 'Import proposal and notification data through the hooks in @/lib/api.',
            },
          ],
        },
      ],
    },
  },

  // Repo scripts print their results to the terminal on purpose.
  {
    files: ['scripts/**/*.mjs'],
    rules: { 'no-console': 'off' },
  },

  // Tests work with loosely typed mocks and fetch responses.
  {
    files: ['**/*.test.{ts,tsx}', 'vitest.setup.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  prettier,
]);
