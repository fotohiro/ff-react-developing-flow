import assert from "node:assert/strict";
import test from "node:test";
import { cartBoxes, weddingBoxLines } from "../api/_wedding-lines.ts";

const gid = (id: string) => `gid://shopify/ProductVariant/${id}`;
const VARIANTS = { galleryVariantId: "100", redeemVariantId: "111", printsVariantId: "222" };
const A = { id: "WB-20260413-015", cid: "77031", prepaid: false, atLab: false };
const B = { id: "WB-20260413-016", cid: "77046", prepaid: false, atLab: false };
const own = (box: { id: string; cid: string }) => [{ key: "camera_id", value: box.cid }, { key: "wedding_box_id", value: box.id }];
const LABEL = [{ key: "_Return Label", value: "https://deliver.goshippo.com/x_qr_code.png" }, { key: "_Return Tracking", value: "9202290368451000245253" }];

test("one paid box: the same single gallery line as before", () => {
  assert.deepEqual(weddingBoxLines({ ...VARIANTS, boxes: [A], printsQty: 0, labelAttributes: LABEL }), [
    { merchandiseId: gid("100"), quantity: 1, attributes: [...own(A), ...LABEL] },
  ]);
});

test("one prepaid box with prints: $0 redeem line plus the Wedding Box prints variant", () => {
  assert.deepEqual(weddingBoxLines({ ...VARIANTS, boxes: [{ ...A, prepaid: true }], printsQty: 2, labelAttributes: [] }), [
    { merchandiseId: gid("111"), quantity: 1, attributes: own(A) },
    { merchandiseId: gid("222"), quantity: 2, attributes: own(A) },
  ]);
});

test("two boxes: every line carries a camera from its own box", () => {
  const lines = weddingBoxLines({ ...VARIANTS, boxes: [A, B], printsQty: 1, labelAttributes: [] });
  assert.deepEqual(lines, [
    { merchandiseId: gid("100"), quantity: 1, attributes: own(A) },
    { merchandiseId: gid("222"), quantity: 1, attributes: own(A) },
    { merchandiseId: gid("100"), quantity: 1, attributes: own(B) },
    { merchandiseId: gid("222"), quantity: 1, attributes: own(B) },
  ]);
});

test("a paid box and a prepaid box share one cart", () => {
  const lines = weddingBoxLines({ ...VARIANTS, boxes: [A, { ...B, prepaid: true }], printsQty: 0, labelAttributes: [] });
  assert.deepEqual(lines.map((l) => l.merchandiseId), [gid("100"), gid("111")]);
});

test("the label goes on the first box still at home, once", () => {
  const lines = weddingBoxLines({ ...VARIANTS, boxes: [{ ...A, atLab: true }, B], printsQty: 1, labelAttributes: LABEL });
  assert.deepEqual(lines.map((l) => l.attributes.length), [2, 2, 4, 2]);
  assert.deepEqual(lines[2].attributes, [...own(B), ...LABEL]);
});

test("with every box at the lab, a label from a resume link stays on the first box", () => {
  const lines = weddingBoxLines({ ...VARIANTS, boxes: [{ ...A, atLab: true }, { ...B, atLab: true }], printsQty: 0, labelAttributes: LABEL });
  assert.deepEqual(lines.map((l) => l.attributes.length), [4, 2]);
});

test("cartBoxes reads the boxes list", () => {
  assert.deepEqual(cartBoxes({ boxes: [A, { id: B.id, cid: B.cid, prepaid: true, atLab: true, extra: 1 }], cid: "77031" }), [A, { ...B, prepaid: true, atLab: true }]);
});

test("cartBoxes falls back to the single box older clients send", () => {
  assert.deepEqual(cartBoxes({ weddingBoxId: A.id, cid: "77031", prepaid: true }), [{ ...A, prepaid: true }]);
  assert.deepEqual(cartBoxes({ weddingBoxId: A.id, cid: "77031" }), [A]);
});

test("cartBoxes is empty for a request with no Wedding Box", () => {
  assert.deepEqual(cartBoxes({ cid: "73010" }), []);
  assert.deepEqual(cartBoxes({ cid: "73010", boxes: [] }), []);
});

test("cartBoxes rejects malformed lists", () => {
  assert.equal(cartBoxes({ boxes: [{ id: A.id }] }), null);
  assert.equal(cartBoxes({ boxes: [{ id: A.id, cid: "0" }] }), null);
  assert.equal(cartBoxes({ boxes: [{ id: "WB 1; drop", cid: "77031" }] }), null);
  assert.equal(cartBoxes({ boxes: [A, A] }), null);
  assert.equal(cartBoxes({ boxes: ["WB-1"] }), null);
  assert.equal(cartBoxes({ boxes: Array.from({ length: 21 }, (_, i) => ({ id: `WB-${i}`, cid: "77031" })) }), null);
});
