import { GraphQLScalarType, Kind, type ValueNode } from 'graphql';

// Minimal JSON scalar for Select option `additionals` — output-only, so `serialize` is the load-bearing path
function parseAst(ast: ValueNode): unknown {
  switch (ast.kind) {
    case Kind.STRING:
    case Kind.BOOLEAN:
      return ast.value;
    case Kind.INT:
    case Kind.FLOAT:
      return Number(ast.value);
    case Kind.OBJECT:
      return Object.fromEntries(ast.fields.map((field) => [field.name.value, parseAst(field.value)]));
    case Kind.LIST:
      return ast.values.map(parseAst);
    case Kind.NULL:
      return null;
    default:
      return undefined;
  }
}

export const GraphQLJSON = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value (used for Select option `additionals`).',
  serialize: (value) => value,
  parseValue: (value) => value,
  parseLiteral: parseAst,
});
