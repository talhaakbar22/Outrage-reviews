import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { env } from "@/lib/env";

export function buildImportCsvPath(syncJobId: string) {
  return path.join(env.storageRoot(), "imports", `${syncJobId}.csv`);
}

export async function saveImportCsv(syncJobId: string, csvContent: string) {
  const absolutePath = path.resolve(buildImportCsvPath(syncJobId));
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, csvContent, "utf8");
  return absolutePath;
}

export { downloadReviewImage, buildPublicMediaUrl, resolveStoredMediaPath } from "./storage";
