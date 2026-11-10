import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

// Images are immediately displayed after upload, so read-after-write consistency is required.
export function imageStore() { return getStore({ name: "shop-images", consistency: "strong" }); }
export class ObjectNotFoundError extends Error {}
export class ObjectStorageService {
  async getObjectEntityUploadURL(): Promise<string> {
    return `/api/storage/upload/${randomUUID()}`;
  }
  normalizeObjectEntityPath(path: string): string {
    return path.replace("/api/storage/upload/", "/objects/");
  }
  async getObjectEntityFile(path: string): Promise<string> {
    if (!/^\/objects\/[a-f0-9-]{36}\.(jpg|png|webp)$/.test(path)) throw new ObjectNotFoundError();
    return path.slice("/objects/".length);
  }
  async downloadObject(key: string): Promise<Response> {
    const data = await imageStore().get(key, { type: "arrayBuffer" });
    if (!data) throw new ObjectNotFoundError();
    const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : "image/jpeg";
    return new Response(data, { headers: { "Content-Type": type, "Cache-Control": "private, no-cache" } });
  }
}
