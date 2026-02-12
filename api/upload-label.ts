import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/upload-label
 * Upload a label image to storage and return a CDN URL
 *
 * Body: multipart form data with "label" file field
 * Returns: { url: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const r2AccountId = process.env.R2_ACCOUNT_ID;
  const r2AccessKey = process.env.R2_ACCESS_KEY;
  const r2SecretKey = process.env.R2_SECRET_KEY;
  const r2Bucket = process.env.R2_BUCKET_NAME;

  if (!r2AccountId || !r2AccessKey || !r2SecretKey || !r2Bucket) {
    // Stub mode — return a placeholder URL
    console.log("[STUB] Label upload — returning placeholder URL");
    return res.status(200).json({
      url: "https://placehold.co/400x200/f0f0f0/999?text=Label+Uploaded",
      stub: true,
    });
  }

  // TODO: Implement actual R2 upload when keys are provided
  // 1. Parse multipart form data (use a library like formidable or busboy)
  // 2. Generate unique filename: labels/{cid}_{timestamp}.jpg
  // 3. Upload to R2 via S3-compatible API
  // 4. Return public CDN URL

  return res.status(501).json({
    error: "R2 upload not yet implemented — add upload logic here",
  });
}
