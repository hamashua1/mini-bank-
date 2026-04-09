export type DbType = 'mongo' | 'mysql' | 'postgres';

export function getDbType(): DbType {
  const val = process.env.DB_TYPE;
  if (val === 'mysql' || val === 'postgres') return val;
  return 'mongo';
}

export function isSqlDb(): boolean {
  const t = getDbType();
  return t === 'mysql' || t === 'postgres';
}
