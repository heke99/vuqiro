/**
 * API rows arrive snake_case from Supabase and camelCase from mock fixtures.
 * `field` returns the first defined key so pages render both shapes.
 */
export type Row = Record<string, unknown>;

export function field<T = string>(row: Row, ...keys: string[]): T | undefined {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null) return value as T;
  }
  return undefined;
}

export function fieldStr(row: Row, ...keys: string[]): string {
  const value = field<unknown>(row, ...keys);
  return value === undefined ? "" : String(value);
}

export function fieldNum(row: Row, ...keys: string[]): number {
  const value = field<unknown>(row, ...keys);
  return typeof value === "number" ? value : Number(value ?? 0) || 0;
}

export function fieldDate(row: Row, ...keys: string[]): string {
  const value = fieldStr(row, ...keys);
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export function usd(cents: number): string {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
