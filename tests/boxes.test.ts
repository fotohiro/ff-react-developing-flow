import assert from "node:assert/strict";
import test from "node:test";
import { boxTotals, chosenBoxes, fetchBoxContext, labelNeeds, linkBox, needsChoice, parseBoxContext, planBoxOffer, showsBoxStep, type Box, type BoxContext, type BoxOffer } from "../src/lib/boxes.ts";

const A = "WB-20260413-015";
const B = "WB-20260413-016";
const C = "WB-20260413-017";
const box = (id: string, over: Partial<Box> = {}): Box => ({ id, cid: id.slice(-3), state: "payable", atLab: false, mixGroup: null, ...over });
const ok = (boxes: Box[], emailMatch = false): BoxContext => ({ status: "ok", emailMatch, boxes });
const LINK = { prepaid: false, atLab: false };
const plan = (context: BoxContext | null, link = LINK) => planBoxOffer(context, A, link);
function boxes(offer: BoxOffer) {
  assert.equal(offer.kind, "boxes");
  return offer as Extract<BoxOffer, { kind: "boxes" }>;
}
const ids = (list: Box[]) => list.map((b) => b.id);

test("no answer, or a box with no inventory record: the single box from the link, as before", () => {
  assert.deepEqual(plan(null), { kind: "link" });
  assert.deepEqual(plan({ status: "unknown", emailMatch: false, boxes: [] }), { kind: "link" });
  assert.deepEqual(plan(ok([box(B)])), { kind: "link" });
  assert.equal(showsBoxStep({ kind: "link" }), false);
});

test("a stale link gets the standard checkout", () => {
  assert.deepEqual(plan({ status: "stale", emailMatch: false, boxes: [] }), { kind: "standard" });
});

test("one unpaid box: no box step", () => {
  const offer = boxes(plan(ok([box(A)])));
  assert.equal(showsBoxStep(offer), false);
  assert.deepEqual(ids(chosenBoxes(offer, null)), [A]);
});

test("two unpaid boxes, buyer's email: all preselected, with the option to pay for just this one", () => {
  const offer = boxes(plan(ok([box(A), box(B)], true)));
  assert.equal(offer.preselectAll, true);
  assert.equal(needsChoice(offer), true);
  assert.equal(showsBoxStep(offer), true);
  assert.deepEqual(ids(chosenBoxes(offer, "all")), [A, B]);
  assert.deepEqual(ids(chosenBoxes(offer, "base")), [A]);
});

test("two unpaid boxes, another email: a plain choice, nothing preselected", () => {
  const offer = boxes(plan(ok([box(A), box(B)], false)));
  assert.equal(offer.preselectAll, false);
  assert.equal(needsChoice(offer), true);
  assert.deepEqual(ids(chosenBoxes(offer, null)), [A]);
});

test("boxes that came back mixed are paid together, whoever pays", () => {
  const offer = boxes(plan(ok([box(A, { mixGroup: A, atLab: true }), box(B, { mixGroup: A, atLab: true })])));
  assert.equal(needsChoice(offer), false);
  assert.equal(showsBoxStep(offer), true);
  assert.deepEqual(ids(chosenBoxes(offer, null)), [A, B]);
  assert.deepEqual(ids(chosenBoxes(offer, "base")), [A, B]);
});

test("a box outside the mix stays optional", () => {
  const offer = boxes(plan(ok([box(A, { mixGroup: A }), box(B, { mixGroup: A }), box(C)])));
  assert.equal(needsChoice(offer), true);
  assert.deepEqual(ids(chosenBoxes(offer, "base")), [A, B]);
  assert.deepEqual(ids(chosenBoxes(offer, "all")), [A, B, C]);
});

test("the scanned box is paid and another is open (Courtney Anderson): offer the open one, no choice", () => {
  const offer = boxes(plan(ok([box(A, { state: "paid", mixGroup: A }), box(B, { mixGroup: A })])));
  assert.deepEqual(offer.base, []);
  assert.equal(needsChoice(offer), false);
  assert.equal(showsBoxStep(offer), true);
  assert.deepEqual(ids(chosenBoxes(offer, null)), [B]);
});

test("a paid box mixed with the scanned one is not charged again", () => {
  const offer = boxes(plan(ok([box(A, { mixGroup: A }), box(B, { state: "paid", mixGroup: A })])));
  assert.deepEqual(ids(offer.all), [A]);
  assert.equal(showsBoxStep(offer), false);
});

test("every box paid: nothing to check out", () => {
  assert.deepEqual(plan(ok([box(A, { state: "paid" }), box(B, { state: "paid" })])), { kind: "paid" });
});

test("the link's prepaid and at-lab flags apply to the scanned box only, and never undo a payment", () => {
  const offer = boxes(plan(ok([box(A), box(B)]), { prepaid: true, atLab: true }));
  assert.deepEqual(offer.all.map((b) => [b.state, b.atLab]), [["prepaid", true], ["payable", false]]);
  assert.deepEqual(plan(ok([box(A, { state: "paid" })]), { prepaid: true, atLab: true }), { kind: "paid" });
});

test("linkBox describes the scanned box from the link alone", () => {
  assert.deepEqual(linkBox(A, "77031", { prepaid: true, atLab: false }), { id: A, cid: "77031", state: "prepaid", atLab: false, mixGroup: null });
});

test("totals: prepaid boxes are free to develop, prints are per box", () => {
  const prices = { wbGallery: 79.99, wbPrints: 70 };
  assert.deepEqual(boxTotals([box(A)], 0, prices), { payable: 1, gallery: 79.99, prints: 0, total: 79.99 });
  assert.deepEqual(boxTotals([box(A), box(B, { state: "prepaid" })], 1, prices), { payable: 1, gallery: 79.99, prints: 140, total: 219.99 });
  assert.deepEqual(boxTotals([box(A, { state: "prepaid" })], 0, prices), { payable: 0, gallery: 0, prints: 0, total: 0 });
});

test("an answer is used only when every part of it is what the checkout expects", () => {
  const good = ok([box(A), box(B, { state: "prepaid", atLab: true, mixGroup: A })], true);
  assert.deepEqual(parseBoxContext(good), good);
  assert.deepEqual(parseBoxContext({ status: "stale", boxes: [] }), { status: "stale", emailMatch: false, boxes: [] });
  // emailMatch is true only when the server says exactly that
  assert.equal(parseBoxContext({ ...good, emailMatch: "yes" })?.emailMatch, false);
  const bad: unknown[] = [
    null,
    "ok",
    { status: "ok" },
    { status: "fine", boxes: [] },
    { status: "ok", boxes: [null] },
    { status: "ok", boxes: [{ ...box(A), state: undefined }] },
    { status: "ok", boxes: [{ ...box(A), state: "free" }] },
    { status: "ok", boxes: [{ ...box(A), cid: 77031 }] },
    { status: "ok", boxes: [{ ...box(A), atLab: "true" }] },
    { status: "ok", boxes: [{ ...box(A), mixGroup: undefined }] },
  ];
  for (const data of bad) assert.equal(parseBoxContext(data), null);
});

test("a failed context request falls back to the link, and says why", async (t) => {
  const warnings: string[] = [];
  t.mock.method(console, "warn", (message: string) => warnings.push(message));
  const answer = (fn: typeof fetch) => t.mock.method(globalThis, "fetch", fn);
  const good = ok([box(A), box(B)], true);

  answer(async () => Response.json(good));
  assert.deepEqual(await fetchBoxContext("77031", A, "a@b.co"), good);
  assert.equal(warnings.length, 0);

  answer(async () => Response.json({ error: "Too many requests" }, { status: 429 }));
  assert.equal(await fetchBoxContext("77031", A, "a@b.co"), null);
  answer(async () => Response.json({ status: "ok", boxes: [null] }));
  assert.equal(await fetchBoxContext("77031", A, "a@b.co"), null);
  answer(async () => { throw new TypeError("Failed to fetch"); });
  assert.equal(await fetchBoxContext("77031", A, "a@b.co"), null);
  answer((_url, init) => new Promise((_resolve, reject) => init!.signal!.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))));
  assert.equal(await fetchBoxContext("77031", A, "a@b.co", 10), null);

  assert.deepEqual(warnings.map((w) => w.match(/\((.*)\)/)?.[1]), ["HTTP 429", "unexpected response", "request failed", "no answer in 10 ms"]);
});

test("a label is asked for, and sent, only while a chosen box is still at home", () => {
  const offer = boxes(plan(ok([box(A, { atLab: true }), box(B)])));
  // all boxes: B is at home, so the label step shows and its label goes to the cart
  assert.deepEqual(labelNeeds(chosenBoxes(offer, "all"), true), { atHome: 1, skipStep: false, send: true });
  // back to just the scanned box, which is at the lab: no step, and the label made for B stays behind
  assert.deepEqual(labelNeeds(chosenBoxes(offer, "base"), true), { atHome: 0, skipStep: true, send: false });
  assert.deepEqual(labelNeeds([box(A), box(B)], false), { atHome: 2, skipStep: false, send: true });
});

test("a single camera follows the link's at_lab flag and keeps its label", () => {
  assert.deepEqual(labelNeeds([], false), { atHome: 0, skipStep: false, send: true });
  assert.deepEqual(labelNeeds([], true), { atHome: 0, skipStep: true, send: true });
});
