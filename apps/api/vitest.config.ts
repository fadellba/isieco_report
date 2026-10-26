import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
    setupFiles: ['./tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DB_NAME: 'isieco_test',
      DB_HOST: '127.0.0.1',
      DB_PORT: '5432',
      DB_USER: 'postgres',
      DB_PASSWORD: '',
      DATABASE_CLIENT: 'postgres',
    },
  },
});
