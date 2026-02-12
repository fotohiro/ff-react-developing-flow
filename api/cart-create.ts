import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * POST /api/cart-create
 * Create a Shopify cart via Storefront API and return checkout URL
 *
 * Body: { format: "scans"|"prints", cid: string, email: string, labelUrl?: string, labelToken?: string }
 * Returns: { checkoutUrl: string }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { format, cid, email, labelUrl, labelToken } = req.body;

  if (!format || !cid || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const storeDomain = process.env.SHOPIFY_STORE_DOMAIN || "fotofoto.io";
  const scansVariantId = process.env.SCANS_VARIANT_ID;
  const printsVariantId = process.env.PRINTS_VARIANT_ID;

  if (!storefrontToken || !scansVariantId || !printsVariantId) {
    const missing = [
      !storefrontToken && "SHOPIFY_STOREFRONT_TOKEN",
      !scansVariantId && "SCANS_VARIANT_ID",
      !printsVariantId && "PRINTS_VARIANT_ID",
    ].filter(Boolean);
    console.error(`[CART] Missing env vars: ${missing.join(", ")}`);
    return res.status(500).json({
      error: `Server misconfigured — missing: ${missing.join(", ")}`,
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

  const variables = {
    input: {
      lines: [
        {
          merchandiseId: `gid://shopify/ProductVariant/${variantId}`,
          quantity: 1,
        },
      ],
      attributes: [
        { key: "camera_id", value: cid },
        { key: "email", value: email },
        ...(labelToken
          ? [{ key: "label_token", value: labelToken }]
          : labelUrl
            ? [{ key: "label_url", value: labelUrl }]
            : []),
      ],
    },
  };

  try {
    const response = await fetch(
      `https://${storeDomain}/api/2024-10/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Storefront-Access-Token": storefrontToken,
        },
        body: JSON.stringify({ query, variables }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Shopify Storefront API error:", errorText);
      return res.status(502).json({ error: "Shopify API error" });
    }

    const data = await response.json();
    const cart = data.data?.cartCreate?.cart;
    const errors = data.data?.cartCreate?.userErrors;

    if (errors?.length > 0) {
      console.error("Shopify cart errors:", errors);
      return res.status(400).json({ error: errors[0].message });
    }

    if (!cart?.checkoutUrl) {
      return res.status(502).json({ error: "No checkout URL returned" });
    }

    return res.status(200).json({ checkoutUrl: cart.checkoutUrl });
  } catch (err) {
    console.error("Cart creation failed:", err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
