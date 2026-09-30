import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { Readable } from "stream";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

router.use("/storage/objects", async (req: Request, res: Response): Promise<void> => {
  try {
    const tail = req.path.startsWith("/") ? req.path.slice(1) : req.path;
    const objectPath = `/objects/${tail}`;

    const file = await objectStorage.getObjectEntityFile(objectPath);
    const webResponse = await objectStorage.downloadObject(file, 0);

    res.setHeader("Content-Type", webResponse.headers.get("Content-Type") ?? "application/octet-stream");
    res.setHeader("Cache-Control", "private, no-cache");

    if (webResponse.body) {
      const nodeStream = Readable.fromWeb(webResponse.body as import("stream/web").ReadableStream);
      nodeStream.pipe(res);
    } else {
      res.end();
    }
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Not found" });
    } else {
      res.status(500).json({ error: "Storage error" });
    }
  }
});

export default router;
