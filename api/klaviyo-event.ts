import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/klaviyo-event
 * Fire a Klaviyo event (server-side to keep API key secret)
 *
 * Body: { event: string, email: string, properties: Record<string, unknown> }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { event, email, properties } = req.body;

  if (!event || !email) {
    return res.status(400).json({ error: "Missing event or email" });
  }

  const apiKey = process.env.KLAVIYO_API_KEY;

  if (!apiKey) {
    // Stub mode — log and return success
    console.log(`[STUB] Klaviyo event: ${event}`, { email, ...properties });
    return res.status(200).json({ success: true, stub: true });
  }

  try {
    const response = await fetch("https://a.klaviyo.com/api/events/", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        revision: "2024-10-15",
      },
      body: JSON.stringify({
        data: {
          type: "event",
          attributes: {
            metric: { data: { type: "metric", attributes: { name: event } } },
            profile: {
              data: {
                type: "profile",
                attributes: { email, ...properties },
              },
            },
            properties,
          },
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Klaviyo API error:", errorText);
      return res.status(502).json({ error: "Klaviyo API error" });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("Klaviyo event failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
