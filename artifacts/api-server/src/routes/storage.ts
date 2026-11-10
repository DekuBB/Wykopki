import express, { Router, type IRouter } from "express";
import { imageStore, ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
const router: IRouter = Router();
const storage = new ObjectStorageService();
const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
router.put("/storage/upload/:id", express.raw({ type: () => true, limit: "4mb" }), async (req, res) => {
  const id = String(req.params.id);
  const extension = extensions[req.get("Content-Type") ?? ""];
  if (!/^[a-f0-9-]{36}$/.test(id) || !extension || !Buffer.isBuffer(req.body) || !req.body.length) {
    res.status(400).json({ error: "Wybierz zdjęcie JPG, PNG lub WebP do 4 MB." }); return;
  }
  const bytes = req.body as Buffer;
  const valid = extension === "jpg" ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : extension === "png" ? bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
    : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  if (!valid) { res.status(400).json({ error: "Nieprawidłowy format zdjęcia." }); return; }
  const key = `${id}.${extension}`;
  await imageStore().set(key, new Uint8Array(bytes).buffer);
  res.json({ objectPath: `/objects/${key}` });
});
router.get("/storage/objects/:key", async (req, res) => {
  try {
    const key = await storage.getObjectEntityFile(`/objects/${req.params.key}`);
    const response = await storage.downloadObject(key);
    res.setHeader("Content-Type", response.headers.get("Content-Type")!);
    res.setHeader("Cache-Control", "private, no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    res.status(error instanceof ObjectNotFoundError ? 404 : 500).json({ error: "Nie można pobrać zdjęcia." });
  }
});
export default router;
