import { defineConfig } from 'vitest/config';

export default defineConfig({
  esbuild: {
    tsconfigRaw: JSON.stringify({
      compilerOptions: {
        jsx: 'react-jsx',
        target: 'ES2022',
      },
    }),
  },
  test: {
    environment: 'node',
  },
});
