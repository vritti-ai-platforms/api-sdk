import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildDependsMap, cascadeLocked, filterGrantedByDeps, prereqClosure } from './permission-deps';

// uom feature: dim.view (root) → view → add/edit/delete; dim.view → dim.add/dim.edit/dim.delete
const UOM_PERMS = [
  { code: 'dim.view', dependsOn: [] },
  { code: 'view', dependsOn: ['dim.view'] },
  { code: 'add', dependsOn: ['view'] },
  { code: 'edit', dependsOn: ['view'] },
  { code: 'delete', dependsOn: ['view'] },
  { code: 'dim.add', dependsOn: ['dim.view'] },
];

test('buildDependsMap keeps only edges to present codes', () => {
  const deps = buildDependsMap([
    { code: 'a', dependsOn: ['b', 'ghost', 'a'] },
    { code: 'b', dependsOn: [] },
  ]);
  assert.deepEqual(deps.get('a'), ['b']); // 'ghost' (absent) and self 'a' dropped
  assert.deepEqual(deps.get('b'), []);
});

test('prereqClosure resolves the transitive chain', () => {
  const deps = buildDependsMap(UOM_PERMS);
  assert.deepEqual(prereqClosure('add', deps).sort(), ['dim.view', 'view']);
  assert.deepEqual(prereqClosure('dim.view', deps), []);
});

test('cascadeLocked: locking a root locks the whole downstream chain', () => {
  const deps = buildDependsMap(UOM_PERMS);
  const codes = UOM_PERMS.map((p) => p.code);

  // Lock dim.view → view, add, edit, delete, dim.add all cascade-locked
  const all = cascadeLocked(codes, new Set(['dim.view']), deps);
  assert.deepEqual([...all].sort(), ['add', 'delete', 'dim.add', 'dim.view', 'edit', 'view']);

  // Lock view → add/edit/delete locked, but dim.view + dim.add stay unlocked (they don't depend on view)
  const viaView = cascadeLocked(codes, new Set(['view']), deps);
  assert.deepEqual([...viaView].sort(), ['add', 'delete', 'edit', 'view']);
});

test('filterGrantedByDeps: drops dependents missing a prerequisite', () => {
  const deps = buildDependsMap(UOM_PERMS);

  // add granted without view → add dropped
  assert.deepEqual([...filterGrantedByDeps(new Set(['add']), deps)], []);

  // full chain granted → all kept
  assert.deepEqual([...filterGrantedByDeps(new Set(['dim.view', 'view', 'add']), deps)].sort(), [
    'add',
    'dim.view',
    'view',
  ]);

  // view granted without dim.view → view (and thus add) dropped
  assert.deepEqual([...filterGrantedByDeps(new Set(['view', 'add']), deps)], []);
});

test('cycle guards: cyclic graph degrades safely (no hang)', () => {
  // a → b → a
  const deps = buildDependsMap([
    { code: 'a', dependsOn: ['b'] },
    { code: 'b', dependsOn: ['a'] },
  ]);
  // cascadeLocked terminates; a direct lock still propagates
  const locked = cascadeLocked(['a', 'b'], new Set(['a']), deps);
  assert.ok(locked.has('a'));
  // filterGrantedByDeps terminates; both present with a cycle are kept
  assert.deepEqual([...filterGrantedByDeps(new Set(['a', 'b']), deps)].sort(), ['a', 'b']);
});
