import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/returns-label
 * Create an international return label via SendCloud for EU customers.
 *
 * The parcel ships FROM the customer TO the FOTO FOTO return hub in Paris.
 * Carrier is chosen per origin country (see COUNTRY_CONFIG); France uses
 * Mondial Relay paperless QR, Italy/Greece use Chronopost (printable).
 *
 * v1: tracking is NOT wired back into the Shopify order — we only generate
 * the label/QR and show/email it to the customer. SendCloud still returns a
 * tracking number, which we pass back for a clean future seam but don't persist.
 *
 * Body: { cid, email, country, address: { name, street, houseNumber, city, postalCode, phone } }
 * Returns: { labelUrl, qrCodeUrl, trackingNumber, carrier, paperless, stub? }
 */

interface CountryConfig {
  methodEnv: string; // env var holding the SendCloud shipping method id
  methodDefault: number | null; // fallback id when env not set
  paperless: boolean; // true = QR drop-off (no printing)
  carrier: string;
}

// Supported EU return origins. Anything else (incl. Turkey) is rejected.
const COUNTRY_CONFIG: Record<string, CountryConfig> = {
  FR: { methodEnv: "SENDCLOUD_METHOD_FR", methodDefault: 30396, paperless: true, carrier: "Mondial Relay" },
  IT: { methodEnv: "SENDCLOUD_METHOD_IT", methodDefault: null, paperless: false, carrier: "Chronopost" },
  GR: { methodEnv: "SENDCLOUD_METHOD_GR", methodDefault: null, paperless: false, carrier: "Chronopost" },
};

// FOTO FOTO return hub (receiver of the return). Overridable via env.
const RETURN_HUB = {
  name: process.env.FF_RETURN_NAME || "FOTO FOTO",
  company: process.env.FF_RETURN_COMPANY || "FOTO FOTO",
  street: process.env.FF_RETURN_STREET || "rue des Halles",
  houseNumber: process.env.FF_RETURN_HOUSE_NUMBER || "12",
  city: process.env.FF_RETURN_CITY || "Paris",
  postalCode: process.env.FF_RETURN_POSTAL_CODE || "75001",
  country: process.env.FF_RETURN_COUNTRY || "FR",
  phone: process.env.FF_RETURN_PHONE || "",
  email: process.env.FF_RETURN_EMAIL || "",
};

const PARCEL_WEIGHT_KG = "0.15"; // single-use camera + mailer

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { cid, email, country, address } = req.body ?? {};
  const originCountry = typeof country === "string" ? country.toUpperCase() : "";

  if (!cid || !email) {
    return res.status(400).json({ error: "Missing cid or email" });
  }

  const cfg = COUNTRY_CONFIG[originCountry];
  if (!cfg) {
    return res.status(422).json({
      error: "unsupported_country",
      message: `International returns aren't available from ${originCountry || "your country"} yet.`,
    });
  }

  if (!address?.name || !address?.street || !address?.houseNumber || !address?.city || !address?.postalCode) {
    return res.status(400).json({ error: "Missing required address fields" });
  }

  const publicKey = process.env.SENDCLOUD_PUBLIC_KEY;
  const secretKey = process.env.SENDCLOUD_SECRET_KEY;
  const methodId = Number(process.env[cfg.methodEnv]) || cfg.methodDefault;

  // Stub mode — no keys or no configured shipping method for this lane.
  if (!publicKey || !secretKey || !methodId) {
    console.log(
      `[RETURNS][STUB] ${originCountry} return for cid=${cid} (${cfg.carrier})` +
        `${!methodId ? " — no method id configured" : ""}`
    );
    const placeholder = cfg.paperless
      ? "https://placehold.co/300x300/f0f0f0/666?text=Return+QR%0A(stub)"
      : "https://placehold.co/400x600/f0f0f0/666?text=Return+Label%0A(stub)";
    return res.status(200).json({
      labelUrl: placeholder,
      qrCodeUrl: cfg.paperless ? placeholder : null,
      trackingNumber: "STUB_RETURN_" + Date.now(),
      carrier: cfg.carrier,
      paperless: cfg.paperless,
      stub: true,
    });
  }

  try {
    const auth = Buffer.from(`${publicKey}:${secretKey}`).toString("base64");

    // is_return=true marks this a return: parcel address = the hub (receiver),
    // from_* = the customer (sender). Intra-EU lanes need no customs docs.
    const body = {
      parcel: {
        name: RETURN_HUB.name,
        company_name: RETURN_HUB.company,
        address: RETURN_HUB.street,
        house_number: RETURN_HUB.houseNumber,
        city: RETURN_HUB.city,
        postal_code: RETURN_HUB.postalCode,
        country: RETURN_HUB.country,
        telephone: RETURN_HUB.phone,
        email: RETURN_HUB.email || email,
        from_name: address.name,
        from_address_1: address.street,
        from_house_number: address.houseNumber,
        from_city: address.city,
        from_postal_code: address.postalCode,
        from_country: originCountry,
        from_telephone: address.phone || "",
        from_email: email,
        order_number: String(cid),
        weight: PARCEL_WEIGHT_KG,
        request_label: true,
        is_return: true,
        shipment: { id: methodId },
      },
    };

    const scRes = await fetch("https://panel.sendcloud.sc/api/v2/parcels?errors=verbose", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify(body),
    });

    if (!scRes.ok) {
      const detail = await scRes.text();
      console.error(`[RETURNS] SendCloud error (${scRes.status}):`, detail);
      return res.status(502).json({ error: "SendCloud API error", detail });
    }

    const data = await scRes.json();
    const parcel = data?.parcel;
    const labelUrl =
      parcel?.label?.normal_printer?.[0] ?? parcel?.label?.label_printer ?? null;
    const trackingNumber = parcel?.tracking_number ?? null;

    console.log(
      `[RETURNS] ${originCountry} label created — parcel=${parcel?.id}, carrier=${cfg.carrier}, tracking=${trackingNumber}`
    );

    return res.status(200).json({
      labelUrl,
      qrCodeUrl: cfg.paperless ? labelUrl : null,
      trackingNumber,
      carrier: cfg.carrier,
      paperless: cfg.paperless,
    });
  } catch (err) {
    console.error("[RETURNS] Label generation failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
