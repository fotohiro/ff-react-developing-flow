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
    console.log(`[STUB] Klaviyo event: ${event}`, { email, ...properties });
    return res.status(200).json({ success: true, stub: true });
  }

  // Build a clean properties object (exclude email — it belongs on the profile)
  const eventProperties: Record<string, unknown> = {};
  if (properties && typeof properties === "object") {
    for (const [k, v] of Object.entries(properties)) {
      if (k !== "email") eventProperties[k] = v;
    }
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        metric: {
          data: {
            type: "metric",
            attributes: { name: event },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: { email },
          },
        },
        properties: eventProperties,
      },
    },
  };

  console.log("[KLAVIYO] Sending event:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch("https://a.klaviyo.com/api/events", {
      method: "POST",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        Authorization: `Klaviyo-API-Key ${apiKey}`,
        Revision: "2024-10-15",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[KLAVIYO] API error (${response.status}):`, errorText);
      return res.status(502).json({
        error: "Klaviyo API error",
        status: response.status,
        detail: errorText,
      });
    }

    console.log("[KLAVIYO] Event sent successfully:", event);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("[KLAVIYO] Request failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
