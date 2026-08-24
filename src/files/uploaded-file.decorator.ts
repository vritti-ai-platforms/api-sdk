import type {} from '@fastify/multipart';
import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { type ClassConstructor, plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import type { FastifyRequest } from 'fastify';
import { BadRequestException } from '../exceptions';

export interface UploadedFileResult {
  buffer: Buffer;
  filename: string;
  mimetype: string;
}

export type UploadedFileMap = Record<string, UploadedFileResult[]>;

export interface MultipartContent {
  fields: Record<string, unknown>;
  files: UploadedFileMap;
}

const PARSED = Symbol('vritti.multipart');

type ParsedRequest = FastifyRequest & { [PARSED]?: Promise<MultipartContent> };

// Reads the whole multipart body once and caches it — the part stream cannot be walked twice
export function readMultipart(request: FastifyRequest): Promise<MultipartContent> {
  const cached = request as ParsedRequest;
  cached[PARSED] ??= (async () => {
    const content: MultipartContent = { fields: {}, files: {} };
    for await (const part of request.parts()) {
      if (part.type === 'file') {
        const file = { buffer: await part.toBuffer(), filename: part.filename, mimetype: part.mimetype };
        const existing = content.files[part.fieldname];
        if (existing) existing.push(file);
        else content.files[part.fieldname] = [file];
      } else {
        content.fields[part.fieldname] = part.value;
      }
    }
    return content;
  })();
  return cached[PARSED];
}

function flatten(files: Record<string, UploadedFileResult[]>): UploadedFileResult[] {
  return Object.values(files).flat();
}

// The single file sent under `fieldName`, or the only file on the request; throws when absent
export const UploadedFile = createParamDecorator(
  async (fieldName: string | undefined, ctx: ExecutionContext): Promise<UploadedFileResult> => {
    const { files } = await readMultipart(ctx.switchToHttp().getRequest<FastifyRequest>());
    const file = (fieldName ? files[fieldName] : flatten(files))?.[0];

    if (!file) {
      const field = fieldName ?? 'file';
      throw new BadRequestException({
        label: 'File Required',
        detail: `Please attach a file${fieldName ? ` under "${fieldName}"` : ''} to your request.`,
        errors: [{ field, message: 'File required' }],
      });
    }
    return file;
  },
);

// Every file under `fieldName` (throws when none), or with no name every file keyed by field name (never throws)
export const UploadedFiles = createParamDecorator(
  async (
    fieldName: string | undefined,
    ctx: ExecutionContext,
  ): Promise<UploadedFileResult[] | Record<string, UploadedFileResult[]>> => {
    const { files } = await readMultipart(ctx.switchToHttp().getRequest<FastifyRequest>());
    if (!fieldName) return files;

    const matched = files[fieldName] ?? [];
    if (matched.length === 0) {
      throw new BadRequestException({
        label: 'Files Required',
        detail: `Please attach at least one file under "${fieldName}" to your request.`,
        errors: [{ field: fieldName, message: 'At least one file is required' }],
      });
    }
    return matched;
  },
);

// The request's text fields validated into `dto`, for a multipart form whose body cannot reach @Body() —
// fastify only surfaces fields while walking the parts, so request.body is empty without attachFieldsToBody.
export const MultipartDto = createParamDecorator(
  async <T extends object>(dtoClass: ClassConstructor<T>, ctx: ExecutionContext): Promise<T> => {
    const { fields } = await readMultipart(ctx.switchToHttp().getRequest<FastifyRequest>());
    const dto = plainToInstance(dtoClass, fields);
    const errors = await validate(dto as object);

    if (errors.length > 0) {
      throw new BadRequestException({
        label: 'Validation Failed',
        detail: 'One or more fields are invalid.',
        errors: errors.map((e) => ({
          field: e.property,
          message: Object.values(e.constraints ?? {})[0] ?? 'Invalid value',
        })),
      });
    }
    return dto;
  },
);
