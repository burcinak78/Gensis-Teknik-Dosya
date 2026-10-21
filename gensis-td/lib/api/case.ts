// API JSON is camelCase; screens moved from Supabase still use the column names (snake_case).
const snake = (k: string) => k.replace(/[A-Z]/g, (c) => "_" + c.toLowerCase());

/** Deep-converts object keys to snake_case (arrays and nested objects included). */
export function toSnake<T = any>(value: unknown): T {
  if (Array.isArray(value)) return value.map((v) => toSnake(v)) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [snake(k), toSnake(v)])) as T;
  }
  return value as T;
}
