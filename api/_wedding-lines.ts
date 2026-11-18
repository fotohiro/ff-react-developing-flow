type Attribute = { key: string; value: string };

export type CartBox = { id: string; cid: string; prepaid: boolean; atLab: boolean };

const MAX_BOXES = 20;
const BOX_ID = /^[A-Za-z0-9_-]{1,60}$/;
const isCid = (value: unknown): value is string => typeof value === "string" && /^\d{1,6}$/.test(value) && parseInt(value, 10) > 0;

/**
 * The boxes a cart request is for: its `boxes` list, or the single `weddingBoxId` that older
 * clients send. Empty when the request is not for a Wedding Box; null when it is malformed.
 */
export function cartBoxes(body: { boxes?: unknown; weddingBoxId?: unknown; cid?: unknown; prepaid?: unknown }): CartBox[] | null {
  const raw: unknown[] = Array.isArray(body.boxes) && body.boxes.length > 0
    ? body.boxes
    : body.weddingBoxId
      ? [{ id: body.weddingBoxId, cid: body.cid, prepaid: body.prepaid === true || body.prepaid === "true" }]
      : [];
  if (raw.length > MAX_BOXES) return null;

  const boxes: CartBox[] = [];
  for (const entry of raw) {
    const box = (entry ?? {}) as Record<string, unknown>;
    if (typeof box.id !== "string" || !BOX_ID.test(box.id) || !isCid(box.cid)) return null;
    if (boxes.some((b) => b.id === box.id)) return null;
    boxes.push({ id: box.id, cid: box.cid, prepaid: box.prepaid === true, atLab: box.atLab === true });
  }
  return boxes;
}

/**
 * Cart lines for a Wedding Box checkout: one gallery line per box (the $0 redeem variant for a
 * prepaid box) and, with prints, one prints line per box. Every line names its box and a camera
 * from that box, which the order webhook checks. Label attributes go on the first box still at home.
 */
export function weddingBoxLines(opts: {
  boxes: CartBox[];
  galleryVariantId?: string;
  redeemVariantId?: string;
  printsVariantId?: string;
  printsQty: number;
  labelAttributes: Attribute[];
}) {
  const { boxes, galleryVariantId, redeemVariantId, printsVariantId, printsQty, labelAttributes } = opts;
  const labelBox = boxes.find((b) => !b.atLab) ?? boxes[0];
  return boxes.flatMap((box) => {
    const attributes = [
      { key: "camera_id", value: box.cid },
      { key: "wedding_box_id", value: box.id },
    ];
    return [
      {
        merchandiseId: `gid://shopify/ProductVariant/${box.prepaid ? redeemVariantId : galleryVariantId}`,
        quantity: 1,
        attributes: box === labelBox ? [...attributes, ...labelAttributes] : attributes,
      },
      ...(printsQty > 0 && printsVariantId
        ? [{ merchandiseId: `gid://shopify/ProductVariant/${printsVariantId}`, quantity: printsQty, attributes }]
        : []),
    ];
  });
}
