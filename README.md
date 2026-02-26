# FOTOFOTO — Film Developing Order Flow (React App)

A purchase wizard that guides customers through ordering film development for their FOTOFOTO disposable cameras. Built with React + TypeScript, deployed on Vercel.

**Live:** https://lab.fotofoto.io

## How It Works

The customer receives a camera with a unique CameraID ("CID"). When they're ready to develop, they scan a QR code on the bottom of their camera. The QR code contains a URL in the format: fotofoto.io/products/developing?cid=12345 where CID is the query parameter at the end of the URL.

When the customer scans the QR code, they hit a Shopify URL Redirect (set in Shopify Admin). fotofoto.io/products/developing redirects to a Vercel router app (ff-camera-router). The router app determines which Shopify product to route the customer to based on their camera data:

1. **Wedding Box** — If the scanned camera document has a weddingBoxID field populated with "WB..." -> wedding-box-developing
2. **Prepaid Developing** — If the scanned camera document has prepaid == true -> developing-prepaid-redeem
3. **Standard Developing** — Else -> developing-standard
4. **Redirect to lab.fotofoto.io** — developing-standard has a 302 redirect to lab.fotofoto.io, which is where this app (ff-react-developing-flow) lives.

The customer now lands on this app, and is prompted through a 4-step wizard:

1. **Email** — enter their email (skipped if pre-filled via URL param)
2. **Format** — choose Digital Scans ($9.99) or Prints + Scans ($16.99)
3. **Label** — photo their return shipping label or generate a replacement via EasyPost
4. **Confirm** — review and checkout via Shopify

## URL Parameters

| Param | Description | Example |
|-------|-------------|---------|
| `cid` | Camera ID (required) | `cid=5847` |
| `lt` | Label token — skips email + label steps (fast-track flow) | `lt=abc123` |
| `email` | Pre-fills email field (used in Klaviyo winback emails) | `email=user@example.com` |
| `discount` | Shopify discount code, auto-applied at checkout | `discount=WINBACK15` |
| `discount_pct` | Discount percentage, shows adjusted prices in the UI | `discount_pct=15` |

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite
- **Hosting:** Vercel (static + serverless functions)
- **Payments:** Shopify Storefront API (cart creation + checkout)
- **Email tracking:** Klaviyo (event tracking for flow triggers)
- **Shipping labels:** EasyPost API (USPS return labels)
- **Image storage:** Vercel Blob (camera-captured label photos)

## API Routes

All serverless functions live in `api/` and deploy as Vercel Functions.

| Route | Method | Description |
|-------|--------|-------------|
| `/api/cart-create` | POST | Creates a Shopify cart with line item properties and optional discount code |
| `/api/klaviyo-event` | POST | Fires a tracking event to Klaviyo |
| `/api/replacement-label` | POST | Generates a USPS return label via EasyPost |
| `/api/upload-label` | POST | Uploads a base64 label image to Vercel Blob, returns CDN URL |

## Klaviyo Events

| Event | Trigger | Properties |
|-------|---------|------------|
| Started Developing | Customer enters email | `cid`, `email` |
| Selected Format | Customer picks scans or prints | `cid`, `email`, `format`, `price` |
| Uploaded Label | Customer provides return label | `cid`, `email`, `has_label` |
| Label Generated | Replacement label created via EasyPost | `cid`, `labelUrl` |
| Completed Checkout | Cart created, redirecting to Shopify | `cid`, `format`, `price`, `checkout_url`, `labelUrl` |

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
