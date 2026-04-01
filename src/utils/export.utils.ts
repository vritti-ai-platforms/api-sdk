import { type BookType, utils, write } from 'xlsx';

export type ExportFormat = 'xlsx' | 'xls' | 'csv' | 'tsv' | 'ods';

const FORMAT_CONFIG: Record<ExportFormat, { bookType: BookType; mimeType: string; ext: string; opts?: Record<string, unknown> }> = {
  xlsx: { bookType: 'xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', ext: 'xlsx' },
  xls: { bookType: 'biff8', mimeType: 'application/vnd.ms-excel', ext: 'xls' },
  csv: { bookType: 'csv', mimeType: 'text/csv', ext: 'csv' },
  tsv: { bookType: 'csv', mimeType: 'text/tab-separated-values', ext: 'tsv', opts: { FS: '\t' } },
  ods: { bookType: 'ods', mimeType: 'application/vnd.oasis.opendocument.spreadsheet', ext: 'ods' },
};

// Converts an array of row objects into a spreadsheet buffer in the given format
export function buildExportBuffer(rows: Record<string, unknown>[], format: ExportFormat = 'xlsx'): Buffer {
  const config = FORMAT_CONFIG[format];
  const ws = utils.json_to_sheet(rows);
  const wb = utils.book_new();
  utils.book_append_sheet(wb, ws, 'Sheet1');
  return write(wb, { type: 'buffer', bookType: config.bookType, ...config.opts }) as Buffer;
}

export function getExportMimeType(format: ExportFormat): string {
  return FORMAT_CONFIG[format].mimeType;
}

export function getExportExt(format: ExportFormat): string {
  return FORMAT_CONFIG[format].ext;
}
