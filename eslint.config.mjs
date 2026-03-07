import js from '@eslint/js';
import globals from 'globals';
import prettierConfig from 'eslint-config-prettier';

export default [
  {
    ignores: ['node_modules/', 'client/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'commonjs',
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      'no-console': 'off',
      'no-var': 'error',
      'prefer-const': 'warn',
    },
  },
  prettierConfig,
];
