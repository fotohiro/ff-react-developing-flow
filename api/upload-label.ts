import type { VercelRequest, VercelResponse } from "@vercel/node";
import { put } from "@vercel/blob";

/**
 * POST /api/upload-label
 * Upload a base64 label image to Vercel Blob and return a permanent CDN URL.
 *
 * Body: { imageData: string (base64 data URL), cid: string }
 * Returns: { url: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { imageData, cid } = req.body;

  if (!imageData || !cid) {
    return res.status(400).json({ error: "Missing imageData or cid" });
  }

  // Validate it's a data URL
  if (!imageData.startsWith("data:image/")) {
    return res.status(400).json({ error: "imageData must be a base64 data URL" });
  }

  try {
    // Strip the data URL prefix: "data:image/jpeg;base64,..." → raw base64
    const base64Data = imageData.split(",")[1];
    if (!base64Data) {
      return res.status(400).json({ error: "Invalid base64 data URL format" });
    }

    const buffer = Buffer.from(base64Data, "base64");

    // Detect content type from the data URL prefix
    const mimeMatch = imageData.match(/^data:(image\/\w+);base64/);
    const contentType = mimeMatch?.[1] ?? "image/jpeg";
    const ext = contentType === "image/png" ? "png" : "jpg";

    const filename = `labels/${cid}_${Date.now()}.${ext}`;

    console.log(
      `[UPLOAD] Uploading label for cid=${cid}, size=${buffer.length} bytes, type=${contentType}`
    );

    const blob = await put(filename, buffer, {
      access: "public",
      contentType,
    });

    console.log(`[UPLOAD] Stored at: ${blob.url}`);

    return res.status(200).json({ url: blob.url });
  } catch (err) {
    console.error("[UPLOAD] Label upload failed:", err);
    return res.status(500).json({
      error: "Failed to upload label image",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
