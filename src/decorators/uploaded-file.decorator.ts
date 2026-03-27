import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BadRequestException } from '../exceptions';

export interface UploadedFileResult {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

/**
 * Extracts a single uploaded file from a Fastify multipart request.
 *
 * Requires `@fastify/multipart` to be registered on the Fastify instance.
 * Throws `BadRequestException` if no file is present in the request.
 *
 * @example
 * ```typescript
 * @Post('upload')
 * @ApiConsumes('multipart/form-data')
 * async upload(@UploadedFile() file: UploadedFileResult) {
 *   // file.buffer, file.filename, file.mimetype
 * }
 * ```
 */
export const UploadedFile = createParamDecorator(
  async (_data: unknown, ctx: ExecutionContext): Promise<UploadedFileResult> => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();

    // request.file() is provided by @fastify/multipart
    const file = await (request as FastifyRequest & { file: () => Promise<any> }).file();

    if (!file) {
      throw new BadRequestException({
        label: 'File Required',
        detail: 'Please attach a file to your request.',
      });
    }

    const buffer = await file.toBuffer();
    return { buffer, filename: file.filename, mimetype: file.mimetype };
  },
);
