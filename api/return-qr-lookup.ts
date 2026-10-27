import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET /api/return-qr-lookup?cid=...&email=...
 *
 * Looks up whether this customer already generated a valid USPS Label Broker QR
 * code in Shippo (within the last 80 days) by matching:
 *   1. `tx.metadata` JSON (`{ cid, email }`) on the transaction, OR
 *   2. `shipment.address_from.email` for older transactions created before
 *      metadata tagging was added.
 *
 * Returns `{ found: true, qrCodeUrl, labelUrl, trackingNumber, trackingUrl }`
 * or `{ found: false }`.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_LOOKBACK_DAYS = 80;

interface ShippoTx {
  object_id: string;
  object_created: string;
  status?: string;
  rate?: string;
  metadata?: string | null;
  tracking_number?: string | null;
  tracking_status?: string | null;
  tracking_url_provider?: string | null;
  qr_code_url?: string | null;
  label_url?: string | null;
}

interface ShippoList<T> {
  next: string | null;
  results: T[];
}

async function shippoGet<T>(token: string, urlOrPath: string): Promise<T> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `https://api.goshippo.com${urlOrPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `ShippoToken ${token}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Shippo ${res.status}`);
  return (await res.json()) as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const cid = String(req.query.cid ?? "").trim();
  const email = String(req.query.email ?? "").trim().toLowerCase();

  if (!cid && !email) {
    return res.status(400).json({ error: "Missing cid or email" });
  }

  const token = process.env.SHIPPO_API_KEY;
  if (!token) {
    return res.status(200).json({ found: false });
  }

  try {
    const now = Date.now();
    let txUrl: string | null = "/transactions/?results=100";
    let pagesChecked = 0;
    const legacyCandidates: ShippoTx[] = [];

    while (txUrl && pagesChecked < 4) {
      pagesChecked++;
      const page: ShippoList<ShippoTx> = await shippoGet(token, txUrl);
      let stopPaging = false;

      for (const tx of page.results ?? []) {
        const createdMs = new Date(tx.object_created).getTime();
        if (Number.isNaN(createdMs)) continue;
        const ageDays = (now - createdMs) / DAY_MS;

        if (ageDays > MAX_LOOKBACK_DAYS) {
          stopPaging = true;
          break;
        }

        if (tx.status !== "SUCCESS" || !tx.qr_code_url || !tx.tracking_number) {
          continue;
        }

        // Fast path: match transaction metadata `{ cid, email }`
        if (tx.metadata) {
          try {
            const meta = JSON.parse(tx.metadata) as { cid?: string; email?: string };
            const cidMatch = cid && meta.cid && String(meta.cid).trim() === cid;
            const emailMatch =
              email && meta.email && String(meta.email).trim().toLowerCase() === email;
            if (cidMatch || emailMatch) {
              return res.status(200).json({
                found: true,
                qrCodeUrl: tx.qr_code_url,
                labelUrl: tx.label_url ?? null,
                trackingNumber: tx.tracking_number,
                trackingUrl: tx.tracking_url_provider ?? null,
              });
            }
          } catch {
            // Non-JSON metadata; fall through
          }
        } else if (email && legacyCandidates.length < 30) {
          legacyCandidates.push(tx);
        }
      }

      if (stopPaging) break;
      txUrl = page.next;
    }

    // Fallback for older transactions (before metadata was added): check shipment address_from.email
    for (const tx of legacyCandidates) {
      if (!tx.rate) continue;
      try {
        const rate = await shippoGet<{ shipment?: string }>(token, `/rates/${tx.rate}`);
        if (!rate.shipment) continue;
        const shipment = await shippoGet<{ address_from?: { email?: string } }>(
          token,
          `/shipments/${rate.shipment}`
        );
        const fromEmail = (shipment.address_from?.email ?? "").trim().toLowerCase();
        if (fromEmail && fromEmail === email) {
          return res.status(200).json({
            found: true,
            qrCodeUrl: tx.qr_code_url,
            labelUrl: tx.label_url ?? null,
            trackingNumber: tx.tracking_number,
            trackingUrl: tx.tracking_url_provider ?? null,
          });
        }
      } catch {
        // Ignore individual lookup errors
      }
    }

    return res.status(200).json({ found: false });
  } catch (err) {
    console.warn("[RETURN_QR_LOOKUP] failed:", err);
    return res.status(200).json({ found: false });
  }
}
