import { defineConfig } from 'vitest/config';

// Unit tests for plain TypeScript modules (no React Native rendering)
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
  },
});
