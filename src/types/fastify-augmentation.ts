declare module 'fastify' {
  interface FastifyRequest {
    sessionInfo?: {
      userId: string;
      sessionId: string;
      sessionType: string;
    };
    cookies?: Record<string, string>;
  }
}

export type {};
