import type { MultipartFile } from '@fastify/multipart';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { BadRequestException } from '../exceptions';

export interface UploadedFileResult {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

async function collectFiles(
  request: FastifyRequest,
  fieldName?: string,
): Promise<{ files: MultipartFile[]; consumed: boolean }> {
  // Single-file shortcut when no fieldName filter is needed
  if (!fieldName) {
    const file = await request.file();
    return { files: file ? [file] : [], consumed: true };
  }

  const matched: MultipartFile[] = [];
  for await (const file of request.files()) {
    if (file.fieldname === fieldName) {
      matched.push(file);
    }
  }
  return { files: matched, consumed: true };
}

/**
 * Extracts a single uploaded file from a Fastify multipart request.
 * Pass an optional field name to match a specific form key.
 *
 * Requires `@fastify/multipart` to be registered on the Fastify instance.
 * Throws `BadRequestException` if no file is present in the request.
 *
 * @example
 * ```typescript
 * @Post('upload')
 * @ApiConsumes('multipart/form-data')
 * async upload(
 *   @UploadedFile() file: UploadedFileResult,          // grabs first file
 *   @UploadedFile('avatar') avatar: UploadedFileResult, // grabs file with key "avatar"
 * ) {}
 * ```
 */
export const UploadedFile = createParamDecorator(
  async (fieldName: string | undefined, ctx: ExecutionContext): Promise<UploadedFileResult> => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const { files } = await collectFiles(request, fieldName);
    const file = files[0];

    if (!file) {
      const field = fieldName ?? 'file';
      throw new BadRequestException({
        label: 'File Required',
        detail: `Please attach a file${fieldName ? ` under "${fieldName}"` : ''} to your request.`,
        errors: [{ field, message: 'File required' }],
      });
    }

    const buffer = await file.toBuffer();
    return { buffer, filename: file.filename, mimetype: file.mimetype };
  },
);

/**
 * Extracts multiple uploaded files from a Fastify multipart request.
 * Pass an optional field name to match only files under a specific form key.
 *
 * Requires `@fastify/multipart` to be registered on the Fastify instance.
 * Throws `BadRequestException` if no files are present in the request.
 *
 * @example
 * ```typescript
 * @Post('upload')
 * @ApiConsumes('multipart/form-data')
 * async upload(
 *   @UploadedFiles() files: UploadedFileResult[],              // grabs all files
 *   @UploadedFiles('documents') docs: UploadedFileResult[],    // grabs files with key "documents"
 * ) {}
 * ```
 */
export const UploadedFiles = createParamDecorator(
  async (fieldName: string | undefined, ctx: ExecutionContext): Promise<UploadedFileResult[]> => {
    const request = ctx.switchToHttp().getRequest<FastifyRequest>();
    const { files } = await collectFiles(request, fieldName);

    if (files.length === 0) {
      const field = fieldName ?? 'files';
      throw new BadRequestException({
        label: 'Files Required',
        detail: `Please attach at least one file${fieldName ? ` under "${fieldName}"` : ''} to your request.`,
        errors: [{ field, message: 'At least one file is required' }],
      });
    }

    const results: UploadedFileResult[] = [];
    for (const file of files) {
      const buffer = await file.toBuffer();
      results.push({ buffer, filename: file.filename, mimetype: file.mimetype });
    }
    return results;
  },
);
