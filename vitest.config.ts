import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/rec2020-pq.icc'],
      thresholds: {
        lines: 75,
        functions: 85,
        branches: 60,
        statements: 75,
      },
    },
  },
})
