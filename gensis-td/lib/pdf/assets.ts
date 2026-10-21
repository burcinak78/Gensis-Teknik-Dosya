// Files under public/ read from disk for PDF generation. The routes used to fetch them from their own
// host, which inside a container is not reachable (or goes out through Cloudflare).
import path from "path";
import { readFile } from "fs/promises";

export const PUBLIC_DIR = path.join(process.cwd(), "public");

export async function readAsset(relative: string): Promise<Uint8Array | null> {
  try {
    return new Uint8Array(await readFile(path.join(PUBLIC_DIR, relative)));
  } catch {
    return null;
  }
}
