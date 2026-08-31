# FOTOFOTO — Film Developing Order Flow (React App)

A purchase wizard that guides customers through ordering film development for their FOTOFOTO disposable cameras. Built with React + TypeScript, deployed on Vercel.

**Live:** https://lab.fotofoto.io

## How It Works

The customer receives a camera with a unique CameraID ("CID"). When they're ready to develop, they scan a QR code on the bottom of their camera. The QR code contains a URL in the format: fotofoto.io/products/developing?cid=12345 where CID is the query parameter at the end of the URL.

When the customer scans the QR code, they hit a Shopify URL Redirect (set in Shopify Admin). fotofoto.io/products/developing redirects to a Vercel router app (ff-camera-router). The router app determines which Shopify product to route the customer to based on their camera data:

1. **Wedding Box** — If the scanned camera document has a weddingBoxID field populated with "WB..." -> wedding-box-developing
2. **Prepaid Developing** — If the scanned camera document has prepaid == true -> this app with `?prepaid=true` (see [Prepaid Redemption](#prepaid-redemption))
3. **Standard Developing** — Else -> developing-standard
4. **Redirect to lab.fotofoto.io** — developing-standard has a 302 redirect to lab.fotofoto.io, which is where this app (ff-react-developing-flow) lives.

The customer now lands on this app, and is prompted through a 4-step wizard:

1. **Email** — enter their email (skipped if pre-filled via URL param)
2. **Format** — choose Digital Scans or Prints + Scans (prices shown in the visitor's local currency — see [Localized Pricing](#localized-pricing))
3. **Label** — photo their return shipping label or generate a replacement via EasyPost
4. **Confirm** — review and checkout via Shopify

## URL Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `cid` | Camera ID (required) | `cid=5847` |
| `prepaid` | Prepaid redemption flow — free digital scans + optional prints add-on | `prepaid=true` |
| `lt` | Label token — skips email + label steps (fast-track flow) | `lt=abc123` |
| `email` | Pre-fills email field (used in Klaviyo winback emails) | `email=user@example.com` |
| `discount` | Shopify discount code, auto-applied at checkout | `discount=WINBACK15` |
| `discount_pct` | Discount percentage, shows adjusted prices in the UI | `discount_pct=15` |
| `country` | Override geo-detected country to preview localized pricing (testing only) | `country=DE` |

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Hosting:** Vercel (static + serverless functions)
- **Payments:** Shopify Storefront API (cart creation + checkout)
- **Email tracking:** Klaviyo (event tracking for flow triggers)
- **Shipping labels:** Shippo API (USPS Label Broker QR for new labels); EasyPost retained for legacy printable returns
- **Image storage:** Vercel Blob (camera-captured label photos)

## API Routes

All serverless functions live in `api/` and deploy as Vercel Functions.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/prices` | GET | Returns localized variant prices for the visitor's country (geo-detected, no login) |
| `/api/returns-label` | POST | Generates a SendCloud international (EU) return label/QR for the customer's country |
| `/api/cart-create` | POST | Creates a Shopify cart with line item properties, optional discount code, and buyer country |
| `/api/klaviyo-event` | POST | Fires a tracking event to Klaviyo |
| `/api/return-qr` | POST | Generates a prepaid USPS Label Broker QR via Shippo (customer → BNY) |
| `/api/replacement-label` | POST | Legacy: printable USPS return label via EasyPost |
| `/api/upload-label` | POST | Uploads a base64 label image to Vercel Blob, returns CDN URL |

## Klaviyo Events

| Event | Trigger | Properties |
|-------|---------|------------|
| Started Developing | Customer enters email | `cid`, `email` |
| Selected Format | Customer picks scans or prints | `cid`, `email`, `format`, `price` |
| Uploaded Label | Customer provides return label | `cid`, `email`, `has_label` |
| Label Generated | Replacement label created via EasyPost | `cid`, `labelUrl` |
| Completed Checkout | Cart created, redirecting to Shopify | `cid`, `format`, `price`, `checkout_url`, `labelUrl` |

## Localized Pricing

Prices are **not hardcoded** — they're fetched live from Shopify and shown in the visitor's local currency (e.g. EUR for European customers), even when the customer isn't logged in.

**How the currency is determined (no login required):**

1. On page load, the app calls `/api/prices`.
2. The serverless route reads the visitor's country from Vercel's edge geo header (`x-vercel-ip-country`) — a free, IP-based signal available on every request.
3. It creates a throwaway Shopify cart with all product variants and the visitor's `buyerIdentity.countryCode`, then reads each line's per-unit cost. This returns the **exact** price Shopify will charge at checkout in the market's currency.
4. The wizard displays those prices, formatted with `Intl.NumberFormat` in the resolved currency (e.g. a German browser renders `8,95 €`).
5. At checkout, `/api/cart-create` passes the same `buyerIdentity.countryCode`, so the checkout currency matches exactly what the customer saw.

**Why a cart probe instead of a product `@inContext` query?** Shopify Markets gates a plain product/variant price query by catalog *publication* — if a product isn't published to a market's catalog, the query returns `null` for it abroad and we'd fall back to USD (a display/checkout mismatch). A cart applies the market's currency conversion to **every** variant regardless of catalog publication, so display always equals checkout. Trade-off: this creates a lightweight abandoned cart per session (no inventory hold, no email attached, minor analytics noise).

**Fallbacks:** If the geo header is missing (e.g. local dev), the country defaults to `US`. If the lookup fails, the app falls back to hardcoded USD prices (defined in `src/lib/pricing.ts` and `api/prices.ts` — keep these in sync).

**Testing:** Append `?country=DE` (or any ISO 3166-1 alpha-2 code) to preview localized pricing without a VPN.

> **Prerequisite:** Localized (non-USD) prices depend on **Shopify Markets** being configured for the target regions. Markets is live (EUR for the EU, GBP for the UK, CAD for Canada, etc.). Note that "The Wedding Box - Development" and "Extra Prints" are not yet published to the international catalogs — the cart probe still localizes them via currency conversion, but publishing them keeps other storefront surfaces consistent.

## International Returns (EU)

Non-US visitors get a different return step. Instead of photographing a US/USPS label (`UploadStep`), they see `IntlReturnStep` — inserted after email and before format — which collects their country + address and generates a **SendCloud** return label/QR shipping back to the FOTO FOTO hub in Paris.

**Country detection & gating:** the country comes from the same geo signal as pricing (`x-vercel-ip-country`, see [Localized Pricing](#localized-pricing)). If the visitor's country isn't `US`, the international return step is used. Supported EU origins in v1 are **FR, IT, GR**; any other non-US country (including Turkey) shows a "not available yet — contact us" message.

**Carrier per origin** (all return to the Paris hub; intra-EU, no customs docs):

| Origin | Carrier | Experience |
|--------|---------|------------|
| FR | Mondial Relay (Point Relais Retour QR) | Paperless QR — drop at any relay, no printing |
| IT | Chronopost 2Shop Retour Europe | Printable label |
| GR | Chronopost 2Shop Retour Europe | Printable label |

Carrier selection is driven by a per-country map in `api/returns-label.ts` keyed to SendCloud shipping method IDs (env vars). If SendCloud keys or a method ID are missing, the route runs in **stub mode** (placeholder QR/label) so the flow stays testable.

**Tracking (v1):** tracking is intentionally **not** wired back to the Shopify order for EU returns — the QR/label is generated and shown/emailed to the customer only. The route already returns a tracking number, leaving a clean seam to persist it (or add a SendCloud webhook) later.

**Testing:** append `?country=FR` (or `IT`/`GR`/`DE`) to preview the international flow without a VPN. `DE` (unsupported) exercises the "not available" state.

## Prepaid Redemption

Cameras flagged `prepaid == true` in Firestore are routed by `ff-camera-router` to this app with `?prepaid=true`. In this flow the customer redeems their prepaid **Digital Scans for free** and may optionally **add prints** (a paid qty add-on). It mirrors the Wedding Box pattern (fixed included base + optional prints), but the base is $0.

- Base line item: `PREPAID_SCANS_VARIANT_ID` (a $0 variant) — always added so the Shopify fulfillment webhook still creates the order/camera records and marks the camera developed.
- Prints add-on: `PREPAID_PRINTS_VARIANT_ID`, quantity chosen in the Format step, priced the same as Extra Prints.
- Return-label steps are unchanged — the physical camera is still returned. If the router appends `&at_lab=true` (courier-return cameras), the return step is skipped as usual.

## WebView Detection

The app detects in-app browsers (Gmail, Instagram, Outlook, etc.) and adapts the label photo step to show a "Select from photos" flow instead of opening the camera directly, which fails in WebViews on iOS.

## Environment Variables

Copy `.env.example` and fill in the values:

```
KLAVIYO_API_KEY=           # Klaviyo private API key
EASYPOST_API_KEY=          # EasyPost API key
SHOPIFY_STOREFRONT_TOKEN=  # Shopify Storefront API access token
SHOPIFY_STORE_DOMAIN=      # e.g. foto-foto-foto.myshopify.com
SCANS_VARIANT_ID=          # Shopify product variant ID for Digital Scans
PRINTS_VARIANT_ID=         # Shopify product variant ID for Prints + Scans
WB_SCANS_VARIANT_ID=       # Wedding Box digital gallery variant
WB_PRINTS_VARIANT_ID=      # Wedding Box prints add-on variant
EXTRA_PRINTS_VARIANT_ID=   # Extra prints add-on variant (standard developing)
PREPAID_SCANS_VARIANT_ID=  # Prepaid redemption base variant ($0 digital scans)
PREPAID_PRINTS_VARIANT_ID= # Prepaid prints add-on variant
SENDCLOUD_PUBLIC_KEY=      # SendCloud API public key (EU return labels)
SENDCLOUD_SECRET_KEY=      # SendCloud API secret key
SENDCLOUD_METHOD_FR=       # Shipping method id per origin (FR/IT/GR)
SENDCLOUD_METHOD_IT=
SENDCLOUD_METHOD_GR=
FF_RETURN_STREET=          # EU return hub address (defaults to 12 rue des Halles, 75001 Paris)
BLOB_READ_WRITE_TOKEN=     # Vercel Blob store token (set automatically on Vercel)
```

## Local Development

```bash
npm install
npm run dev
```

API routes require the Vercel CLI for local testing:

```bash
npx vercel dev
```

## Deployment

Push to `main` — Vercel auto-deploys. The domain `lab.fotofoto.io` is routed via Cloudflare.
