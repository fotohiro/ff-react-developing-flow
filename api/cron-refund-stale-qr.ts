import type { VercelRequest, VercelResponse } from "@vercel/node";

/**
 * GET/POST /api/cron-refund-stale-qr
 *
 * Daily rolling Vercel Cron job:
 *   Finds Shippo USPS Label Broker QR transactions that are:
 *     - status === "SUCCESS" and qr_code_url present
 *     - tracking_status === "PRE_TRANSIT" (never scanned by USPS)
 *     - age between 80 and 89 days (USPS refund window closes at 90 days)
 *     - not already refunded
 *   and submits a refund request to Shippo (`POST /refunds/`).
 *
 * Optional query params (for manual runs):
 *   - ?minDays=80  (override minimum age in days, default 80)
 *   - ?maxDays=89  (override maximum age in days, default 89)
 *   - ?dryRun=1    (list candidates without calling POST /refunds/)
 */

const DAY_MS = 24 * 60 * 60 * 1000;

interface ShippoTx {
  object_id: string;
  object_created: string;
  status?: string;
  tracking_number?: string | null;
  tracking_status?: string | null;
  qr_code_url?: string | null;
}

interface ShippoRefund {
  object_id: string;
  transaction: string;
  status: "QUEUED" | "PENDING" | "SUCCESS" | "ERROR";
}

interface ShippoList<T> {
  next: string | null;
  results: T[];
}

async function shippoRequest<T>(
  token: string,
  urlOrPath: string,
  init?: RequestInit
): Promise<T> {
  const url = urlOrPath.startsWith("http")
    ? urlOrPath
    : `https://api.goshippo.com${urlOrPath}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `ShippoToken ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Shippo ${res.status} on ${urlOrPath}: ${
        typeof data === "object" ? JSON.stringify(data) : String(data)
      }`
    );
  }
  return data as T;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Optional CRON_SECRET guard if configured in Vercel env
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = process.env.SHIPPO_API_KEY;
  if (!token) {
    return res.status(500).json({ error: "Missing SHIPPO_API_KEY" });
  }

  const minDays = Number(req.query.minDays ?? 80);
  const maxDays = Number(req.query.maxDays ?? 89);
  const dryRun =
    req.query.dryRun === "1" ||
    req.query.dryRun === "true";

  try {
    const now = Date.now();

    // 1. Load existing refunds so we don't re-submit
    const alreadyRefunded = new Set<string>();
    let refundUrl: string | null = "/refunds/?results=100";
    while (refundUrl) {
      const page: ShippoList<ShippoRefund> = await shippoRequest(token, refundUrl);
      for (const r of page.results ?? []) {
        if (r.transaction && r.status !== "ERROR") {
          alreadyRefunded.add(r.transaction);
        }
      }
      refundUrl = page.next;
    }

    // 2. Page through transactions (newest -> oldest); stop once past maxDays
    const candidates: Array<{
      transaction_id: string;
      tracking_number: string | null | undefined;
      created_at: string;
      age_days: number;
    }> = [];

    let txUrl: string | null = "/transactions/?results=100";
    let stopPaging = false;

    while (txUrl && !stopPaging) {
      const page: ShippoList<ShippoTx> = await shippoRequest(token, txUrl);
      for (const tx of page.results ?? []) {
        const createdMs = new Date(tx.object_created).getTime();
        if (Number.isNaN(createdMs)) continue;
        const ageDays = (now - createdMs) / DAY_MS;

        // Transactions are ordered newest-first; once older than maxDays + 5d buffer, stop paging
        if (ageDays > maxDays + 5) {
          stopPaging = true;
          break;
        }

        if (
          tx.status === "SUCCESS" &&
          tx.qr_code_url &&
          tx.tracking_status === "PRE_TRANSIT" &&
          ageDays >= minDays &&
          ageDays <= maxDays &&
          !alreadyRefunded.has(tx.object_id)
        ) {
          candidates.push({
            transaction_id: tx.object_id,
            tracking_number: tx.tracking_number,
            created_at: tx.object_created,
            age_days: Math.floor(ageDays * 10) / 10,
          });
        }
      }
      txUrl = page.next;
    }

    // 3. Double-check live USPS tracking status before voiding, then submit refund
    const refunded: Array<{
      transaction_id: string;
      tracking_number: string | null | undefined;
      age_days: number;
      refund_id?: string;
      refund_status?: string;
      skipped_reason?: string;
    }> = [];

    for (const c of candidates) {
      // Safety check: query live tracking endpoint to make sure USPS hasn't scanned it
      if (c.tracking_number) {
        try {
          const liveTrack = await shippoRequest<{
            tracking_status?: { status?: string } | null;
          }>(token, `/tracks/usps/${c.tracking_number}`);
          const liveStatus = liveTrack.tracking_status?.status;
          if (liveStatus && liveStatus !== "PRE_TRANSIT" && liveStatus !== "UNKNOWN") {
            refunded.push({
              ...c,
              skipped_reason: `Live USPS status is ${liveStatus}`,
            });
            continue;
          }
        } catch {
          // Proceed if tracking lookup fails; transaction itself is PRE_TRANSIT
        }
      }

      if (dryRun) {
        refunded.push({ ...c, refund_status: "DRY_RUN" });
        continue;
      }

      try {
        const ref = await shippoRequest<ShippoRefund>(token, "/refunds/", {
          method: "POST",
          body: JSON.stringify({ transaction: c.transaction_id, async: false }),
        });
        console.log(
          `[REFUND_QR] Refunded tx=${c.transaction_id} tracking=${c.tracking_number} age=${c.age_days}d status=${ref.status}`
        );
        refunded.push({
          ...c,
          refund_id: ref.object_id,
          refund_status: ref.status,
        });
      } catch (err) {
        console.error(`[REFUND_QR] Failed tx=${c.transaction_id}:`, err);
        refunded.push({
          ...c,
          refund_status: "ERROR",
          skipped_reason: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return res.status(200).json({
      ok: true,
      dryRun,
      windowDays: { minDays, maxDays },
      candidatesFound: candidates.length,
      results: refunded,
    });
  } catch (err) {
    console.error("[REFUND_QR] Cron failed:", err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
