import type { VercelRequest, VercelResponse } from "@vercel/node";
import { buyerCountryFor, isValidCid, marketEnv, resolveMarket, storeFor } from "./_markets.js";

/**
 * POST /api/cart-create
 * Create a Shopify cart via Storefront API and return checkout URL
 *
 * Body: { format: "scans"|"prints", cid: string, email: string, market?: "us"|"my", labelUrl?: string, labelToken?: string, labelTracking?: string, weddingBoxId?: string }
 * Returns: { checkoutUrl: string, market: "us"|"my" }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { format, cid, email, country, market: requestedMarket, labelUrl, labelToken, labelTracking, weddingBoxId, prepaid, printsQty, extraPrintsQty, discountCode } = req.body;
  const market = resolveMarket(requestedMarket);

  // Validate the country so the checkout localizes to the same currency the
  // customer was shown. Invalid/empty → let Shopify use its default market.
  const countryCode =
    typeof country === "string" && /^[A-Z]{2}$/.test(country.toUpperCase())
      ? country.toUpperCase()
      : undefined;
  const buyerCountry = buyerCountryFor(market, countryCode);

  if (!format || !cid || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  if (!isValidCid(cid)) {
    return res.status(400).json({ error: "Invalid camera ID" });
  }

  const { domain: storeDomain, storefrontToken } = storeFor(market);
  const scansVariantId = marketEnv(market, "SCANS_VARIANT_ID");
  const printsVariantId = marketEnv(market, "PRINTS_VARIANT_ID");
  const wbGalleryVariantId = marketEnv(market, "WB_SCANS_VARIANT_ID");
  const wbPrintsVariantId = marketEnv(market, "WB_PRINTS_VARIANT_ID");
  const extraPrintsVariantId = marketEnv(market, "EXTRA_PRINTS_VARIANT_ID");
  const prepaidScansVariantId = marketEnv(market, "PREPAID_SCANS_VARIANT_ID");
  const prepaidPrintsVariantId = marketEnv(market, "PREPAID_PRINTS_VARIANT_ID");

  const requiredEnv = [
    !storefrontToken && "SHOPIFY_STOREFRONT_TOKEN",
    !scansVariantId && "SCANS_VARIANT_ID",
    !printsVariantId && "PRINTS_VARIANT_ID",
  ].filter(Boolean);

  if (weddingBoxId) {
    if (!wbGalleryVariantId) requiredEnv.push("WB_SCANS_VARIANT_ID");
    if (printsQty > 0 && !wbPrintsVariantId) requiredEnv.push("WB_PRINTS_VARIANT_ID");
  }
  if (prepaid) {
    if (!prepaidScansVariantId) requiredEnv.push("PREPAID_SCANS_VARIANT_ID");
    if (printsQty > 0 && !prepaidPrintsVariantId) requiredEnv.push("PREPAID_PRINTS_VARIANT_ID");
  }
  if (extraPrintsQty > 0 && !extraPrintsVariantId) {
    requiredEnv.push("EXTRA_PRINTS_VARIANT_ID");
  }

  if (requiredEnv.length > 0) {
    console.error(`[CART] Missing env vars for market ${market}: ${requiredEnv.join(", ")}`);
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
    ...(labelTracking ? [{ key: "_Return Tracking", value: labelTracking }] : []),
  ];

  const attributes = rawAttributes.filter((attr) => {
    if (!attr.value) return false;                        // drop empty/falsy
    if (attr.value.startsWith("data:")) return false;     // safety: drop base64 data URLs (too large for Shopify)
    if (attr.value.length > MAX_ATTR_VALUE_LENGTH) return false; // safety: drop oversized values
    return true;
  });

  // Build cart lines — wedding box orders have a base gallery + optional prints add-on
  let lines;
  if (prepaid && prepaidScansVariantId) {
    // Prepaid redemption — $0 digital scans base + optional prints add-on
    lines = [
      {
        merchandiseId: `gid://shopify/ProductVariant/${prepaidScansVariantId}`,
        quantity: 1,
        ...(attributes.length > 0 ? { attributes } : {}),
      },
      ...(printsQty > 0 && prepaidPrintsVariantId
        ? [{
            merchandiseId: `gid://shopify/ProductVariant/${prepaidPrintsVariantId}`,
            quantity: printsQty,
            attributes: [{ key: "camera_id", value: cid }],
          }]
        : []),
    ];
  } else if (weddingBoxId && wbGalleryVariantId) {
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
      ...(buyerCountry ? { buyerIdentity: { countryCode: buyerCountry } } : {}),
    },
  };

  try {
    const apiUrl = `https://${storeDomain}/api/2024-10/graphql.json`;

    console.log(`[CART] Creating cart: market=${market}, format=${format}, cid=${cid}, attrs=${attributes.length}${weddingBoxId ? `, wb=${weddingBoxId}, prints=${printsQty || 0}` : ""}${prepaid ? `, prepaid=true, prints=${printsQty || 0}` : ""}${extraPrintsQty > 0 ? `, extraPrints=${extraPrintsQty}` : ""}, lines=${lines.length}`);

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
    return res.status(200).json({ checkoutUrl: cart.checkoutUrl, market });
  } catch (err) {
    console.error("[CART] Cart creation failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
