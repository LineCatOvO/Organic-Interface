import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'packages/kernel/src/__tests__/*.test.ts',
      'packages/plugins/src/base/__tests__/*.test.ts',
      'packages/plugins/src/interfaces/__tests__/*.test.ts',
      'packages/plugins/src/loaders/__tests__/*.test.ts',
      'packages/plugins/src/registry/__tests__/*.test.ts',
      'packages/utils/src/__tests__/*.test.ts',
      'packages/utils/src/errors/__tests__/*.test.ts',
      'packages/plugins/src/core-conversation/src/__tests__/*.test.ts',
      'packages/plugins/src/core-conversation/src/errors/__tests__/*.test.ts',
      'packages/storage/src/__tests__/*.test.ts',
      'packages/agent/src/**/*.test.ts',
      'packages/tools/src/**/*.test.ts',
      'packages/ui/src/**/*.test.ts',
      'packages/interface/src/__tests__/*.test.ts',
      'e2e/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.turbo/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.test.ts', '**/*.config.ts'],
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: {
      '@organic/utils': path.resolve(__dirname, './packages/utils/src'),
      '@organic/kernel': path.resolve(__dirname, './packages/kernel/src'),
      '@organic/plugins': path.resolve(__dirname, './packages/plugins/src'),
      '@organic/agent': path.resolve(__dirname, './packages/agent/src'),
      '@organic/storage': path.resolve(__dirname, './packages/storage/src'),
      '@organic/tools': path.resolve(__dirname, './packages/tools/src'),
      '@organic/ui': path.resolve(__dirname, './packages/ui/src'),
      '@organic/interface': path.resolve(__dirname, './packages/interface/src'),
    },
    extensions: ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs'],
  },
});
