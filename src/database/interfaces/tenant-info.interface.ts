export interface TenantInfo {
  id: string;
  subdomain: string;
  type: 'SHARED' | 'DEDICATED';
  status: string;
  schemaName?: string;
  databaseName?: string;
  databaseHost?: string;
  databasePort?: number;
  databaseUsername?: string;
  databasePassword?: string;
  databaseSslMode?: string;
  connectionPoolSize?: number;
}
