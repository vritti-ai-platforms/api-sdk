# Backend Repository Query Pattern

Repositories extend `PrimaryBaseRepository` or `TenantBaseRepository` which provide two query interfaces:
- `this.model` - Clean Drizzle ORM model methods
- `this.db` - Low-level Drizzle query builder

## Rule: Prefer this.model first, use this.db only when necessary

```typescript
// GOOD - Use this.model for simple equality lookups
async findByUserIdAndChannel(userId: string, channel: VerificationChannel): Promise<Verification | undefined> {
  return this.model.findFirst({
    where: { userId, channel },
  });
}

// GOOD - Use this.db for complex conditions
async isTargetVerifiedByOtherUser(target: string, excludeUserId?: string): Promise<boolean> {
  let condition = and(eq(verifications.target, target), eq(verifications.isVerified, true));

  if (excludeUserId) {
    condition = and(condition, ne(verifications.userId, excludeUserId));
  }

  const count = await this.db
    .select({ count: sql<number>`count(*)` })
    .from(verifications)
    .where(condition);

  return Number(count[0]?.count) > 0;
}

// GOOD - Use this.db for atomic SQL operations
async incrementAttempts(id: string): Promise<Verification> {
  const results = (await this.db
    .update(verifications)
    .set({
      attempts: sql`${verifications.attempts} + 1`,
    })
    .where(eq(verifications.id, id))
    .returning()) as Verification[];
  return results[0];
}
```

## When to use each

### Use this.model for:
- Simple equality lookups: `where: { field: value }`
- Multiple field equality: `where: { field1: value1, field2: value2 }`
- CRUD operations: `create()`, `update()`, `delete()`, `findMany()`
- Basic queries without complex logic

### Use this.db for:
- Complex conditions: `ne()` (not equal), `or()`, `not()`, `gt()`, `lt()`
- SQL expressions: `sql\`${column} + 1\``
- Aggregations: `count()`, `sum()`, `avg()`, `max()`, `min()`
- Atomic operations: increment, decrement, bulk updates
- Custom joins and subqueries
- Queries requiring `returning()` with custom logic

## Benefits

- **Cleaner code** - `this.model` methods are more concise for simple cases
- **Type safety** - Both interfaces provide full TypeScript types
- **Consistency** - Use the simplest tool for the job
- **Performance** - No difference, both use Drizzle under the hood
