// Re-export zod as a subpath so servers author MCP tool schemas against the SAME zod instance the tool pipeline
// validates and serialises with — a second copy would make every ZodType a foreign object to the registry.
export * from 'zod';
