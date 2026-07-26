import { defineConfig } from 'vitest/config';

// Vitest resolves the `@/*` alias itself (Metro/Babel handle it at app runtime,
// but the test runner needs its own mapping). Runtime `@/...` imports are rare
// in the pure lib code under test — most `@/types/db` imports are `import type`
// and erased — but the alias keeps any real one working. `.pathname` (a string)
// avoids a Node-vs-DOM `URL` type clash from the Expo tsconfig's lib.
export default defineConfig({
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
  },
});
