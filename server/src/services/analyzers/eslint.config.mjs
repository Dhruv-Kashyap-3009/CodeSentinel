/**
 * Self-contained ESLint config used by the JavaScript analyzer. It is passed to
 * ESLint explicitly so the reviewed project's own config never runs against
 * pasted code, and it needs no extra plugins.
 */
const browserAndNodeGlobals = {
  console: 'readonly', window: 'readonly', document: 'readonly', fetch: 'readonly',
  navigator: 'readonly', localStorage: 'readonly', setTimeout: 'readonly', setInterval: 'readonly',
  clearTimeout: 'readonly', clearInterval: 'readonly', queueMicrotask: 'readonly',
  process: 'readonly', Buffer: 'readonly', module: 'writable', require: 'readonly', exports: 'writable',
  __dirname: 'readonly', URL: 'readonly', URLSearchParams: 'readonly', TextEncoder: 'readonly',
  TextDecoder: 'readonly', structuredClone: 'readonly', AbortController: 'readonly', globalThis: 'readonly',
};

export default [
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs', '**/*.jsx'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: browserAndNodeGlobals },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': 'warn',
      'no-redeclare': 'error',
      'no-dupe-keys': 'error',
      'no-dupe-args': 'error',
      'no-unreachable': 'error',
      'no-fallthrough': 'error',
      'no-cond-assign': 'error',
      'no-constant-condition': 'warn',
      'no-self-assign': 'error',
      'no-unsafe-negation': 'error',
      'no-async-promise-executor': 'error',
      'no-await-in-loop': 'warn',
      'require-atomic-updates': 'warn',
      'eqeqeq': 'warn',
      'no-empty': 'warn',
    },
  },
];
