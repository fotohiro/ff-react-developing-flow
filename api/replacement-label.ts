import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/replacement-label
 * Generate an EasyPost scan-based USPS return label
 *
 * Body: { cid: string, email: string }
 * Returns: { labelUrl: string, trackingNumber: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cid, email } = req.body;

  if (!cid || !email) {
    return res.status(400).json({ error: "Missing cid or email" });
  }

  const apiKey = process.env.EASYPOST_API_KEY;

  if (!apiKey) {
    // Stub mode — return a placeholder
    console.log(`[STUB] Replacement label for cid=${cid}, email=${email}`);
    return res.status(200).json({
      labelUrl: "https://placehold.co/400x200/f0f0f0/999?text=Replacement+Label",
      trackingNumber: "STUB_TRACKING_123",
      stub: true,
    });
  }

  try {
    // 1. Create EasyPost shipment with return label
    const easyPostRes = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        shipment: {
          is_return: true,
          to_address: {
            // FOTOFOTO lab address — replace with actual
            company: "FOTO FOTO",
            street1: "63 Flushing Ave",
            street2: "Bldg 131, Ste 30",
            city: "Brooklyn",
            state: "NY",
            zip: "11205",
            country: "US",
          },
          from_address: {
            // Will be overridden by customer when they drop off
            name: "Customer",
            street1: "TBD",
            city: "TBD",
            state: "NY",
            zip: "10001",
            country: "US",
          },
          parcel: {
            weight: 8, // ounces
            length: 6,
            width: 4,
            height: 3,
          },
          carrier_accounts: [], // Uses default
          service: "First",
        },
      }),
    });

    if (!easyPostRes.ok) {
      const errorText = await easyPostRes.text();
      console.error("EasyPost API error:", errorText);
      return res.status(502).json({ error: "EasyPost API error" });
    }

    const shipment = await easyPostRes.json();

    // 2. Buy the cheapest rate
    const rate = shipment.rates?.[0];
    if (!rate) {
      return res.status(502).json({ error: "No rates available" });
    }

    const buyRes = await fetch(
      `https://api.easypost.com/v2/shipments/${shipment.id}/buy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ rate: { id: rate.id } }),
      }
    );

    if (!buyRes.ok) {
      const errorText = await buyRes.text();
      console.error("EasyPost buy error:", errorText);
      return res.status(502).json({ error: "Failed to purchase label" });
    }

    const purchased = await buyRes.json();

    return res.status(200).json({
      labelUrl: purchased.postage_label?.label_url,
      trackingNumber: purchased.tracking_code,
    });
  } catch (err) {
    console.error("Replacement label generation failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
