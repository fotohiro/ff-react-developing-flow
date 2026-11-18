/** Wedding Boxes that shipped together, and what the checkout offers for them. */

export type BoxState = "payable" | "prepaid" | "paid";

export interface Box {
  id: string;
  /** A camera from this box. The box's cart lines carry it. */
  cid: string;
  state: BoxState;
  atLab: boolean;
  /** Shared by boxes whose cameras came back mixed together; null otherwise. */
  mixGroup: string | null;
}

/** Response of ff-photo-db POST /api/wedding-box-context. */
export interface BoxContext {
  status: "ok" | "stale" | "unknown";
  emailMatch: boolean;
  boxes: Box[];
}

export type BoxOffer =
  /** No usable answer: one box, taken from the link, as before. */
  | { kind: "link" }
  /** The link no longer describes this camera: standard single-camera checkout. */
  | { kind: "standard" }
  /** Every box is paid for: nothing to check out. */
  | { kind: "paid" }
  /** `all` is every unpaid box; `base` is the least the customer can check out (empty when the scanned box is paid). */
  | { kind: "boxes"; base: Box[]; all: Box[]; preselectAll: boolean };

export type BoxChoice = "base" | "all";

/** What the link itself says about the scanned box. */
export interface LinkHints {
  prepaid: boolean;
  atLab: boolean;
}

const CONTEXT_URL = "https://ff-photo-db.vercel.app/api/wedding-box-context";

const STATUSES: readonly unknown[] = ["ok", "stale", "unknown"];
const STATES: readonly unknown[] = ["payable", "prepaid", "paid"];

/** The endpoint's answer as a BoxContext, or null when any part of it is not what the checkout expects. */
export function parseBoxContext(data: unknown): BoxContext | null {
  if (!data || typeof data !== "object") return null;
  const { status, emailMatch, boxes } = data as Record<string, unknown>;
  if (!STATUSES.includes(status) || !Array.isArray(boxes)) return null;
  const wellFormed = boxes.every(
    (b) =>
      b &&
      typeof b === "object" &&
      typeof b.id === "string" &&
      typeof b.cid === "string" &&
      STATES.includes(b.state) &&
      typeof b.atLab === "boolean" &&
      (b.mixGroup === null || typeof b.mixGroup === "string")
  );
  if (!wellFormed) return null;
  return { status: status as BoxContext["status"], emailMatch: emailMatch === true, boxes: boxes as Box[] };
}

/**
 * null on any failure or after `timeoutMs`; the checkout then behaves as it did before. Each
 * failure is logged, because a silent one looks exactly like a customer with a single box.
 */
export async function fetchBoxContext(cid: string, wbid: string, email: string, timeoutMs = 5000): Promise<BoxContext | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const fallBack = (why: string, detail?: unknown) => {
    console.warn(`Wedding Box context unavailable (${why}); offering the one box from the link.`, ...(detail === undefined ? [] : [detail]));
    return null;
  };
  try {
    const res = await fetch(CONTEXT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cid, wbid, email }),
      signal: controller.signal,
    });
    if (!res.ok) return fallBack(`HTTP ${res.status}`);
    return parseBoxContext(await res.json()) ?? fallBack("unexpected response");
  } catch (error) {
    return fallBack(controller.signal.aborted ? `no answer in ${timeoutMs} ms` : "request failed", error);
  } finally {
    clearTimeout(timer);
  }
}

/** The scanned box as the link describes it, for when there is no context. */
export function linkBox(wbid: string, cid: string, link: LinkHints): Box {
  return { id: wbid, cid, state: link.prepaid ? "prepaid" : "payable", atLab: link.atLab, mixGroup: null };
}

export function planBoxOffer(context: BoxContext | null, wbid: string, link: LinkHints): BoxOffer {
  if (!context || context.status === "unknown") return { kind: "link" };
  if (context.status === "stale") return { kind: "standard" };
  if (!context.boxes.some((b) => b.id === wbid)) return { kind: "link" };

  // The link can know more than the context about the scanned box: never charge for a box the
  // link calls prepaid, and never ask for a label on one it says is at the lab.
  const boxes = context.boxes.map((b): Box =>
    b.id !== wbid ? b : { ...b, state: b.state === "payable" && link.prepaid ? "prepaid" : b.state, atLab: b.atLab || link.atLab }
  );
  const all = boxes.filter((b) => b.state !== "paid");
  if (all.length === 0) return { kind: "paid" };

  const scanned = all.find((b) => b.id === wbid);
  const base = !scanned ? [] : all.filter((b) => b === scanned || (scanned.mixGroup !== null && b.mixGroup === scanned.mixGroup));
  return { kind: "boxes", base, all, preselectAll: context.emailMatch };
}

type Boxes = Extract<BoxOffer, { kind: "boxes" }>;

/** True when the customer picks between `base` and `all`. */
export function needsChoice(offer: Boxes): boolean {
  return offer.base.length > 0 && offer.all.length > offer.base.length;
}

/** The box step appears when there is something to choose or explain; one unpaid box needs neither. */
export function showsBoxStep(offer: BoxOffer): boolean {
  return offer.kind === "boxes" && (needsChoice(offer) || offer.base.length !== 1);
}

/** The boxes going into the cart. Until the customer picks, the smaller set. */
export function chosenBoxes(offer: Boxes, choice: BoxChoice | null): Box[] {
  return !needsChoice(offer) || choice === "all" ? offer.all : offer.base;
}

/**
 * What the chosen boxes mean for the return label. `atHome` boxes still need to be sent in; with
 * none, the label step is skipped and no label goes to the cart, so one made for an earlier,
 * larger selection cannot land on a box that is already at the lab. A checkout without boxes
 * (a single camera) follows the link's own at_lab flag and always sends the label it has.
 */
export function labelNeeds(boxes: Box[], linkAtLab: boolean): { atHome: number; skipStep: boolean; send: boolean } {
  if (boxes.length === 0) return { atHome: 0, skipStep: linkAtLab, send: true };
  const atHome = boxes.filter((b) => !b.atLab).length;
  return { atHome, skipStep: atHome === 0, send: atHome > 0 };
}

/** Prints are per box: `printsQty` sets for every box in the cart. Prepaid boxes cost nothing to develop. */
export function boxTotals(boxes: Box[], printsQty: number, prices: { wbGallery: number; wbPrints: number }) {
  const payable = boxes.filter((b) => b.state !== "prepaid").length;
  const gallery = payable * prices.wbGallery;
  const prints = printsQty * boxes.length * prices.wbPrints;
  return { payable, gallery, prints, total: gallery + prints };
}
