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
    exceptions: 'src/exceptions/index.ts',
    money: 'src/money/index.ts',
    // Dedicated entry so the large icon-names.json (~352KB) only loads via the
    // './icons' subpath, never bundled into the main barrel.
    icons: 'src/icons/index.ts',
    'catalog-resolver': 'src/catalog-resolver/index.ts',
    license: 'src/license/index.ts',
    signing: 'src/signing/index.ts',
    cache: 'src/cache/index.ts',
    email: 'src/email/index.ts',
    auth: 'src/auth/index.ts',
    context: 'src/context/index.ts',
    'data-table': 'src/data-table/index.ts',
    database: 'src/database/index.ts',
    decorators: 'src/decorators/index.ts',
    filters: 'src/filters/index.ts',
    logger: 'src/logger/index.ts',
    root: 'src/root/index.ts',
    types: 'src/types/index.ts',
    utils: 'src/utils/index.ts',
  },

  // Output formats
  format: ['cjs', 'esm'],

  // Generate .d.ts files - resolve() function allows handling optional deps
  dts: {
    resolve: false,
    compilerOptions: {
      skipLibCheck: true,
      // Resolve self-subpath imports (@vritti/api-sdk/*) to source during declaration
      // emit — otherwise the DTS pass (which uses tsconfig.build.json with empty paths)
      // falls back to node resolution and hits the yet-unbuilt dist/*.js (TS7016).
      // resolve:false keeps the import external in the emitted .d.ts, so cross-entry
      // types still reference the sibling subpath rather than being inlined.
      baseUrl: '.',
      paths: {
        '@vritti/api-sdk/*': ['./src/*/index.ts', './src/*.ts'],
      },
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
    // Self-package subpath imports must stay external so cross-entry runtime singletons
    // (NestJS DI tokens like PrimaryDatabaseService / CacheService) resolve to ONE module copy.
    /^@vritti\/api-sdk\//,
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

  // Build tsconfig strips `paths` so esbuild keeps '@vritti/api-sdk/*' external
  // (self-subpath imports must stay require()s, not get inlined by path remapping).
  tsconfig: './tsconfig.build.json',
});
