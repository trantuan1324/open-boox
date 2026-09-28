import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist/**', 'coverage/**', 'jest.config.js']),
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      // Express error handlers need all four parameters, and rest-destructuring drops keys by naming them `_x`.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },
]);
