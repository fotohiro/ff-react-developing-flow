type Attribute = { key: string; value: string };

export function prepaidWeddingBoxLines(opts: {
  redeemVariantId: string;
  printsVariantId?: string;
  printsQty: number;
  attributes: Attribute[];
  cid: string;
  weddingBoxId: string;
}) {
  const { redeemVariantId, printsVariantId, printsQty, attributes, cid, weddingBoxId } = opts;
  return [
    {
      merchandiseId: `gid://shopify/ProductVariant/${redeemVariantId}`,
      quantity: 1,
      ...(attributes.length > 0 ? { attributes } : {}),
    },
    ...(printsQty > 0 && printsVariantId
      ? [{
          merchandiseId: `gid://shopify/ProductVariant/${printsVariantId}`,
          quantity: printsQty,
          attributes: [
            { key: "camera_id", value: cid },
            { key: "wedding_box_id", value: weddingBoxId },
          ],
        }]
      : []),
  ];
}
