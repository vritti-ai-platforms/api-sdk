---
description: Backend repository layer conventions
globs: api-nexus/src/**/*.repository.ts
---

# Backend Repository Files

Repositories handle all database access. They extend `PrimaryBaseRepository` from `@vritti/api-sdk`.

## Pattern

```typescript
@Injectable()
export class SessionRepository extends PrimaryBaseRepository<typeof sessions> {
  constructor(database: PrimaryDatabaseService) {
    super(database, sessions);
  }

  // Custom query methods below
  // Base methods inherited: create(), findById(), update(), delete(), findMany(), findOne()
}
```

## Drizzle ORM conventions

- Use Drizzle operators for custom conditions: `eq`, `and`, `or`, `inArray` from `@vritti/api-sdk/drizzle-orm`
- Use object-based queries for relational data: `{ where: { field: value }, with: { relation: true } }`
- No raw SQL — Drizzle query builder only

## Type exports

```typescript
type User = typeof users.$inferSelect;
type NewUser = typeof users.$inferInsert;
```

## No business logic in repositories

```typescript
// WRONG — validation in repository
async create(data: NewUser) {
  if (!data.email) throw new BadRequestException('Email required');
  return super.create(data);
}

// CORRECT — repository does data access only
async create(data: NewUser) {
  return super.create(data);
}
```

Validation belongs in the service layer.
