import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/prices
 * Returns localized prices for every product variant, resolved to the
 * visitor's country. Country is inferred from Vercel's edge geo header
 * (`x-vercel-ip-country`) — no login required — with an optional
 * `?country=XX` override for testing.
 *
 * Prices are read from a throwaway Shopify cart created with the visitor's
 * `buyerIdentity.countryCode`. We use a cart (rather than a plain product
 * `@inContext` query) on purpose: our developing products aren't all published
 * to Shopify's international market catalogs, so a product query returns null
 * for most of them abroad — but the cart still applies each market's currency
 * conversion. Reading the cart's per-line cost therefore gives the exact price
 * the customer will be charged at checkout, guaranteeing display == checkout.
 *
 * Returns: { country, currencyCode, prices, fallback }
 */

const VARIANT_ENV_KEYS = {
  scans: "SCANS_VARIANT_ID",
  prints: "PRINTS_VARIANT_ID",
  wbGallery: "WB_SCANS_VARIANT_ID",
  wbPrints: "WB_PRINTS_VARIANT_ID",
  extraPrints: "EXTRA_PRINTS_VARIANT_ID",
} as const;

type PriceKey = keyof typeof VARIANT_ENV_KEYS;

// USD fallback — kept in sync with Shopify; used if the price lookup fails.
const FALLBACK_PRICES: Record<PriceKey, number> = {
  scans: 9.99,
  prints: 16.99,
  wbGallery: 79.99,
  wbPrints: 70.0,
  extraPrints: 7.0,
};

const CART_MUTATION = `
  mutation PriceProbe($input: CartInput!) {
    cartCreate(input: $input) {
      cart {
        lines(first: 20) {
          nodes {
            cost {
              amountPerQuantity {
                amount
                currencyCode
              }
            }
            merchandise {
              ... on ProductVariant {
                id
              }
            }
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Resolve country: explicit override (testing) → Vercel edge geo header → US
  const override = typeof req.query.country === "string" ? req.query.country : "";
  const headerCountry = (req.headers["x-vercel-ip-country"] as string) || "";
  const raw = (override || headerCountry).toUpperCase();
  const country = /^[A-Z]{2}$/.test(raw) ? raw : "US";

  const storefrontToken = process.env.SHOPIFY_STOREFRONT_TOKEN;
  const storeDomain =
    process.env.SHOPIFY_STORE_DOMAIN || "foto-foto-foto.myshopify.com";

  // Map each configured variant to its price key
  const idToKey = new Map<string, PriceKey>();
  const lines: { merchandiseId: string; quantity: number }[] = [];
  (Object.keys(VARIANT_ENV_KEYS) as PriceKey[]).forEach((key) => {
    const variantId = process.env[VARIANT_ENV_KEYS[key]];
    if (variantId) {
      const gid = `gid://shopify/ProductVariant/${variantId}`;
      idToKey.set(gid, key);
      lines.push({ merchandiseId: gid, quantity: 1 });
    }
  });

  // Always return a full price set — prime with USD fallback
  const prices: Record<PriceKey, number> = { ...FALLBACK_PRICES };
  let currencyCode = "USD";

  if (!storefrontToken || lines.length === 0) {
    return res
      .status(200)
      .json({ country, currencyCode, prices, fallback: true });
  }

  try {
    const apiUrl = `https://${storeDomain}/api/2024-10/graphql.json`;
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Shopify-Storefront-Private-Token": storefrontToken,
      },
      body: JSON.stringify({
        query: CART_MUTATION,
        variables: { input: { lines, buyerIdentity: { countryCode: country } } },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(`[PRICES] Shopify API error (${response.status}):`, detail);
      return res
        .status(200)
        .json({ country, currencyCode, prices, fallback: true });
    }

    const data = await response.json();
    const errors = data?.data?.cartCreate?.userErrors;
    if (errors?.length > 0) {
      console.error("[PRICES] Cart errors:", errors);
      return res
        .status(200)
        .json({ country, currencyCode, prices, fallback: true });
    }

    const nodes: Array<{
      cost?: { amountPerQuantity?: { amount: string; currencyCode: string } };
      merchandise?: { id?: string };
    }> = data?.data?.cartCreate?.cart?.lines?.nodes ?? [];

    let matched = 0;
    for (const node of nodes) {
      const gid = node?.merchandise?.id;
      const per = node?.cost?.amountPerQuantity;
      if (!gid || !per) continue;
      const key = idToKey.get(gid);
      if (!key) continue;
      const amount = Number(per.amount);
      if (Number.isFinite(amount)) {
        prices[key] = amount;
        currencyCode = per.currencyCode || currencyCode;
        matched++;
      }
    }

    return res
      .status(200)
      .json({ country, currencyCode, prices, fallback: matched === 0 });
  } catch (err) {
    console.error("[PRICES] Lookup failed:", err);
    return res
      .status(200)
      .json({ country, currencyCode, prices, fallback: true });
  }
}
