import assert from "node:assert/strict";
import test from "node:test";
import { prepaidWeddingBoxLines } from "../api/_wedding-lines.ts";

const attributes = [{ key: "camera_id", value: "70003" }, { key: "wedding_box_id", value: "WB-1" }];

test("scans only: one $0 redeem line carrying the attributes", () => {
  assert.deepEqual(prepaidWeddingBoxLines({ redeemVariantId: "111", printsVariantId: "222", printsQty: 0, attributes, cid: "70003", weddingBoxId: "WB-1" }), [
    { merchandiseId: "gid://shopify/ProductVariant/111", quantity: 1, attributes },
  ]);
});

test("prints use the Wedding Box prints variant", () => {
  const lines = prepaidWeddingBoxLines({ redeemVariantId: "111", printsVariantId: "222", printsQty: 2, attributes, cid: "70003", weddingBoxId: "WB-1" });
  assert.deepEqual(lines[1], {
    merchandiseId: "gid://shopify/ProductVariant/222",
    quantity: 2,
    attributes: [{ key: "camera_id", value: "70003" }, { key: "wedding_box_id", value: "WB-1" }],
  });
});
