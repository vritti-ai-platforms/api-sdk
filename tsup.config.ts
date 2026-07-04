import { defineConfig } from 'tsup';

export default defineConfig({
  // Entry points
  entry: {
    index: 'src/index.ts',
    migrate: 'src/migrate.ts',
    nats: 'src/nats.ts',
    decimal: 'src/decimal.ts',
    'drizzle-orm': 'src/drizzle-orm.ts',
    'drizzle-pg-core': 'src/drizzle-pg-core.ts',
    xlsx: 'src/xlsx.ts',
    lodash: 'src/lodash.ts',
    money: 'src/money/index.ts',
    // Dedicated entry so the large icon-names.json (~352KB) only loads via the
    // './icons' subpath, never bundled into the main barrel.
    icons: 'src/icons/index.ts',
    'catalog-resolver': 'src/catalog-resolver/index.ts',
    license: 'src/license/index.ts',
    signing: 'src/signing/index.ts',
    cache: 'src/cache/index.ts',
    email: 'src/email/index.ts',
  },

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
    '@nestjs/graphql',
    '@nestjs/swagger',
    'class-transformer',
    'class-validator',
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
