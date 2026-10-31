import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { toolOk } from './tool-result';

class PermissionDto {
  id = 'p-1';
  code = 'view';
  createdAt = new Date('2026-01-02T03:04:05.000Z');
  dependsOn: string[] = [];
}

function firstText(result: ReturnType<typeof toolOk>): unknown {
  const [block] = result.content;
  return block?.type === 'text' ? block.text : undefined;
}

describe('toolOk', () => {
  it('turns a class instance into a plain record with ISO dates', () => {
    const result = toolOk(new PermissionDto());

    assert.equal(Object.getPrototypeOf(result.structuredContent), Object.prototype);
    assert.deepEqual(result.structuredContent, {
      id: 'p-1',
      code: 'view',
      createdAt: '2026-01-02T03:04:05.000Z',
      dependsOn: [],
    });
    assert.equal(firstText(result), JSON.stringify(result.structuredContent));
  });

  it('passes a plain object through unchanged', () => {
    const payload = { success: true, message: 'Done.', data: { id: 'f-1', tags: ['a'] } };
    const result = toolOk(payload);

    assert.deepEqual(result.structuredContent, payload);
    assert.equal(firstText(result), JSON.stringify(payload));
  });

  it('wraps arrays under result, converting class instances inside', () => {
    const result = toolOk([new PermissionDto()]);

    assert.deepEqual(result.structuredContent, {
      result: [{ id: 'p-1', code: 'view', createdAt: '2026-01-02T03:04:05.000Z', dependsOn: [] }],
    });
  });

  it('wraps primitives under result', () => {
    assert.deepEqual(toolOk(42).structuredContent, { result: 42 });
    assert.deepEqual(toolOk('ok').structuredContent, { result: 'ok' });
    assert.deepEqual(toolOk(null).structuredContent, { result: null });
  });

  it('wraps a top-level Date as an ISO string', () => {
    assert.deepEqual(toolOk(new Date('2026-01-02T03:04:05.000Z')).structuredContent, {
      result: '2026-01-02T03:04:05.000Z',
    });
  });

  it('does not throw on undefined', () => {
    const result = toolOk(undefined);

    assert.deepEqual(result.structuredContent, { result: undefined });
    assert.equal(firstText(result), undefined);
  });
});
