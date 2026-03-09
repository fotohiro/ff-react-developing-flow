import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/cart-create
 * Create a Shopify cart via Storefront API and return checkout URL
 *
 * Body: { format: "scans"|"prints", cid: string, email: string, labelUrl?: string, labelToken?: string, weddingBoxId?: string }
 * Returns: { checkoutUrl: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { format, cid, email, labelUrl, labelToken, weddingBoxId, printsQty, extraPrintsQty, discountCode } = req.body;

  if (!format || !cid || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || "foto-foto-foto.myshopify.com";
  const scansVariantId = process.env.SCANS_VARIANT_ID;
  const printsVariantId = process.env.PRINTS_VARIANT_ID;
  const wbGalleryVariantId = process.env.WB_SCANS_VARIANT_ID;
  const wbPrintsVariantId = process.env.WB_PRINTS_VARIANT_ID;
  const extraPrintsVariantId = process.env.EXTRA_PRINTS_VARIANT_ID;

  const requiredEnv = [
    !storefrontToken && "SHOPIFY_STOREFRONT_TOKEN",
    !scansVariantId && "SCANS_VARIANT_ID",
    !printsVariantId && "PRINTS_VARIANT_ID",
  ].filter(Boolean);

  if (weddingBoxId) {
    if (!wbGalleryVariantId) requiredEnv.push("WB_SCANS_VARIANT_ID");
    if (printsQty > 0 && !wbPrintsVariantId) requiredEnv.push("WB_PRINTS_VARIANT_ID");
  }
  if (extraPrintsQty > 0 && !extraPrintsVariantId) {
    requiredEnv.push("EXTRA_PRINTS_VARIANT_ID");
  }

  if (requiredEnv.length > 0) {
    console.error(`[CART] Missing env vars: ${requiredEnv.join(", ")}`);
    return res.status(500).json({
      error: `Server misconfigured — missing: ${requiredEnv.join(", ")}`,
    });
  }

  const variantId =
    format === "scans" ? scansVariantId : printsVariantId;

  const query = `
    mutation cartCreate($input: CartInput!) {
      cartCreate(input: $input) {
        cart {
          checkoutUrl
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Build cart attributes, filtering out anything that would break Shopify
  const MAX_ATTR_VALUE_LENGTH = 500;

  const rawAttributes = [
    { key: "camera_id", value: cid },
    ...(weddingBoxId ? [{ key: "wedding_box_id", value: weddingBoxId }] : []),
    ...(labelToken
      ? [{ key: "_Return Label", value: labelToken }]
      : labelUrl
        ? [{ key: "_Return Label", value: labelUrl }]
        : []),
  ];

  const attributes = rawAttributes.filter((attr) => {
    if (!attr.value) return false;                        // drop empty/falsy
    if (attr.value.startsWith("data:")) return false;     // safety: drop base64 data URLs (too large for Shopify)
    if (attr.value.length > MAX_ATTR_VALUE_LENGTH) return false; // safety: drop oversized values
    return true;
  });

  // Build cart lines — wedding box orders have a base gallery + optional prints add-on
  let lines;
  if (weddingBoxId && wbGalleryVariantId) {
    const baseAttributes = attributes;
    lines = [
      {
        merchandiseId: `gid://shopify/ProductVariant/${wbGalleryVariantId}`,
        quantity: 1,
        ...(baseAttributes.length > 0 ? { attributes: baseAttributes } : {}),
      },
      ...(printsQty > 0 && wbPrintsVariantId
        ? [{
            merchandiseId: `gid://shopify/ProductVariant/${wbPrintsVariantId}`,
            quantity: printsQty,
            attributes: [
              { key: "camera_id", value: cid },
              { key: "wedding_box_id", value: weddingBoxId },
            ],
          }]
        : []),
    ];
  } else {
    lines = [
      {
        merchandiseId: `gid://shopify/ProductVariant/${variantId}`,
        quantity: 1,
        ...(attributes.length > 0 ? { attributes } : {}),
      },
      ...(extraPrintsQty > 0 && extraPrintsVariantId
        ? [{
            merchandiseId: `gid://shopify/ProductVariant/${extraPrintsVariantId}`,
            quantity: extraPrintsQty,
            attributes: [{ key: "camera_id", value: cid }],
          }]
        : []),
    ];
  }

  const variables = {
    input: {
      lines,
      ...(discountCode ? { discountCodes: [discountCode] } : {}),
    },
  };

  try {
    const apiUrl = `https://${storeDomain}/api/2024-10/graphql.json`;

    console.log(`[CART] Creating cart: format=${format}, cid=${cid}, attrs=${attributes.length}${weddingBoxId ? `, wb=${weddingBoxId}, prints=${printsQty || 0}` : ""}${extraPrintsQty > 0 ? `, extraPrints=${extraPrintsQty}` : ""}, lines=${lines.length}`);

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": storefrontToken,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[CART] Shopify API error (${response.status}):`, errorText);
      return res.status(502).json({
        error: "Shopify API error",
        status: response.status,
        detail: errorText,
      });
    }

    const data = await response.json();

    const cart = data.data?.cartCreate?.cart;
    const errors = data.data?.cartCreate?.userErrors;

    if (errors?.length > 0) {
      console.error("[CART] Shopify cart errors:", errors);
      return res.status(400).json({
        error: errors[0].message,
        code: errors[0].code,
        detail: errors,
      });
    }

    if (!cart?.checkoutUrl) {
      console.error("[CART] No checkout URL in response:", JSON.stringify(data));
      return res.status(502).json({
        error: "No checkout URL returned",
        detail: JSON.stringify(data),
      });
    }

    console.log("[CART] Checkout URL created:", cart.checkoutUrl);
    return res.status(200).json({ checkoutUrl: cart.checkoutUrl });
  } catch (err) {
    console.error("[CART] Cart creation failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
