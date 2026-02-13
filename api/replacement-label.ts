import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/replacement-label
 * Generate an EasyPost USPS return label (GroundAdvantage, cheapest)
 *
 * Body: { cid: string, email: string, address: { name, street1, street2?, city, state, zip } }
 * Returns: { labelUrl: string, trackingNumber: string, trackingUrl: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cid, email, address } = req.body;

  if (!cid || !email) {
    return res.status(400).json({ error: "Missing cid or email" });
  }

  if (!address?.name || !address?.street1 || !address?.city || !address?.state || !address?.zip) {
    return res.status(400).json({ error: "Missing required address fields" });
  }

  const apiKey = process.env.EASYPOST_API_KEY;

  if (!apiKey) {
    // Stub mode — return a placeholder
    console.log(`[STUB] Replacement label for cid=${cid}, email=${email}`);
    return res.status(200).json({
      labelUrl: "https://placehold.co/400x200/f0f0f0/999?text=Replacement+Label",
      trackingNumber: "STUB_TRACKING_123",
      trackingUrl: "#",
      stub: true,
    });
  }

  try {
    // 1. Create EasyPost return shipment
    //    - to_address = FOTOFOTO lab (destination for returns)
    //    - from_address = generic sender (customer drops off at any USPS)
    //    - is_return = true swaps to/from on the label automatically
    console.log(`[LABEL] Creating return label for cid=${cid}, email=${email}`);

    const easyPostRes = await fetch("https://api.easypost.com/v2/shipments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        shipment: {
          is_return: true,
          // With is_return=true, EasyPost swaps to/from on the label.
          // Pass in "original shipment" orientation:
          //   to_address = customer (becomes FROM on the return label)
          //   from_address = FOTOFOTO (becomes TO on the return label)
          to_address: {
            name: address.name,
            street1: address.street1,
            ...(address.street2 ? { street2: address.street2 } : {}),
            city: address.city,
            state: address.state,
            zip: address.zip,
            country: "US",
          },
          from_address: {
            company: "FOTO FOTO",
            street1: "63 Flushing Avenue",
            street2: "Building 280, Suite 414",
            city: "Brooklyn",
            state: "NY",
            zip: "11205",
            country: "US",
            phone: "2012927506",
          },
          parcel: {
            weight: 8,  // ounces — single-use camera + mailer
            length: 6,
            width: 4,
            height: 3,
          },
          options: {
            label_format: "PNG",
          },
        },
      }),
    });

    if (!easyPostRes.ok) {
      const errorText = await easyPostRes.text();
      console.error("[LABEL] EasyPost shipment error:", errorText);
      return res.status(502).json({
        error: "EasyPost API error",
        detail: errorText,
      });
    }

    const shipment = await easyPostRes.json();
    console.log(
      `[LABEL] Shipment ${shipment.id} created, ${shipment.rates?.length ?? 0} rates`
    );

    // 2. Filter to USPS rates only, pick cheapest
    const uspsRates = (shipment.rates ?? [])
      .filter((r: any) => r.carrier === "USPS")
      .sort((a: any, b: any) => parseFloat(a.rate) - parseFloat(b.rate));

    if (uspsRates.length === 0) {
      console.error("[LABEL] No USPS rates returned:", shipment.rates);
      return res.status(502).json({ error: "No USPS rates available" });
    }

    const cheapest = uspsRates[0];
    console.log(
      `[LABEL] Buying ${cheapest.service} @ $${cheapest.rate} (${cheapest.est_delivery_days}d)`
    );

    // 3. Buy the label
    const buyRes = await fetch(
      `https://api.easypost.com/v2/shipments/${shipment.id}/buy`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({ rate: { id: cheapest.id } }),
      }
    );

    if (!buyRes.ok) {
      const errorText = await buyRes.text();
      console.error("[LABEL] EasyPost buy error:", errorText);
      return res.status(502).json({
        error: "Failed to purchase label",
        detail: errorText,
      });
    }

    const purchased = await buyRes.json();
    const labelUrl = purchased.postage_label?.label_url;
    const trackingNumber = purchased.tracking_code;
    const trackingUrl = purchased.tracker?.public_url;

    console.log(
      `[LABEL] Label purchased — tracking: ${trackingNumber}, url: ${labelUrl}`
    );

    return res.status(200).json({
      labelUrl,
      trackingNumber,
      trackingUrl: trackingUrl ?? null,
    });
  } catch (err) {
    console.error("[LABEL] Replacement label generation failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
