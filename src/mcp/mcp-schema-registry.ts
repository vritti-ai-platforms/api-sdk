import { Injectable } from '@nestjs/common';
import type { OpenAPIObject } from '@nestjs/swagger';

type JsonSchema = Record<string, unknown>;

const COMPONENT_REF = '#/components/schemas/';

// Serves the request DTO schemas the REST API already documents (descriptions, examples, enums) to tools that
// describe resources. The server hands over its live Swagger document at boot, so schemas cannot drift from the DTOs.
@Injectable()
export class McpSchemaRegistry {
  private schemas: Record<string, JsonSchema> = {};

  setDocument(document: OpenAPIObject): void {
    this.schemas = (document.components?.schemas ?? {}) as Record<string, JsonSchema>;
  }

  // The schema for a DTO class, with its component references inlined as local $defs
  schemaFor(dto: { name: string }): JsonSchema {
    const root = this.schemas[dto.name];
    if (!root) return { type: 'object', description: `The schema for ${dto.name} is unavailable.` };
    const defs: Record<string, JsonSchema> = {};
    const rewritten = this.rewrite(root, defs);
    return Object.keys(defs).length > 0 ? { ...rewritten, $defs: defs } : rewritten;
  }

  private rewrite(node: unknown, defs: Record<string, JsonSchema>): JsonSchema {
    if (Array.isArray(node)) return node.map((item) => this.rewrite(item, defs)) as unknown as JsonSchema;
    if (typeof node !== 'object' || node === null) return node as JsonSchema;

    const record = node as JsonSchema;
    if (typeof record.$ref === 'string' && record.$ref.startsWith(COMPONENT_REF)) {
      const name = record.$ref.slice(COMPONENT_REF.length);
      if (!(name in defs)) {
        // Placeholder first, so a self-referencing schema terminates
        defs[name] = {};
        defs[name] = this.rewrite(this.schemas[name] ?? {}, defs);
      }
      return { $ref: `#/$defs/${name}` };
    }

    const out: JsonSchema = {};
    for (const [key, value] of Object.entries(record)) out[key] = this.rewrite(value, defs);
    return out;
  }
}
