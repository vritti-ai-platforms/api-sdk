import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: ['src/index.ts', 'src/drizzle-orm.ts', 'src/drizzle-pg-core.ts'],

  // Output formats
  format: ['cjs', 'esm'],

  // Generate .d.ts files - resolve() function allows handling optional deps
  dts: {
    resolve: false,
    compilerOptions: {
      skipLibCheck: true,
    },
  },

  // Clean output directory before build
  clean: true,

  // Source maps for debugging
  sourcemap: true,

  // Minify in production
  minify: process.env.NODE_ENV === 'production',

  // Target ES2022 for modern features
  target: 'es2022',

  // Output directory
  outDir: 'dist',

  // Handle node protocol imports
  shims: true,

  // Split code for better tree-shaking (for ESM)
  splitting: false,

  // Skip node_modules bundling
  skipNodeModulesBundle: true,

  // Keep class names for decorators
  keepNames: true,

  // External dependencies - don't bundle peer dependencies or optional Prisma clients
  external: [
    '@nestjs/common',
    '@nestjs/core',
    'reflect-metadata',
    'rxjs',
    '@prisma/client',
    '@prisma/cloud-client',
  ],

  // Platform configuration for Node.js
  platform: 'node',

  // Reference tsconfig for decorator metadata
  tsconfig: './tsconfig.json',
});
