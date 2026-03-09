import { type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";

export type FormatType = "scans" | "prints";

interface Props {
  format: FormatType | null;
  discountPct?: number | null;
  isWeddingBox?: boolean;
  printsQty?: number;
  onPrintsQtyChange?: (qty: number) => void;
  onChange: (f: FormatType) => void;
  onNext: () => void;
  onBack: () => void;
}

const STANDARD_OPTIONS: { id: FormatType; label: string; price: number }[] = [
  { id: "scans", label: "Digital Scans", price: 9.99 },
  { id: "prints", label: "Prints + Scans", price: 16.99 },
];

const WB_GALLERY_PRICE = 79.99;
const WB_PRINTS_PRICE = 70.0;

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function FormatStep({
  format,
  discountPct,
  isWeddingBox,
  printsQty = 0,
  onPrintsQtyChange,
  onChange,
  onNext,
  onBack,
}: Props) {
  if (isWeddingBox) {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />

        <h1 style={headline}>
          Your wedding{"\n"}gallery.
        </h1>

        {/* Base: Digital Gallery — always included */}
        <div style={{ ...card, backgroundColor: "var(--color-selected)", borderColor: "var(--color-border)" }}>
          <span style={cardLabel}>Digital Gallery</span>
          <span style={cardPrice}>{fmt(WB_GALLERY_PRICE)}</span>
        </div>

        {/* Add-on: Prints */}
        <div style={addonSection}>
          <button
            type="button"
            onClick={() => {
              if (printsQty > 0) {
                onPrintsQtyChange?.(0);
              } else {
                onPrintsQtyChange?.(1);
              }
            }}
            style={{
              ...card,
              backgroundColor: printsQty > 0 ? "var(--color-selected)" : "var(--color-bg)",
              borderColor: "var(--color-border)",
            }}
          >
            <div style={addonLeft}>
              <div style={checkbox}>
                {printsQty > 0 && <div style={checkboxFill} />}
              </div>
              <span style={cardLabel}>Add Prints</span>
            </div>
            <span style={cardPrice}>{fmt(WB_PRINTS_PRICE)}/ea</span>
          </button>

          {/* Quantity selector — visible when prints enabled */}
          {printsQty > 0 && (
            <div style={qtyRow}>
              <span style={qtyLabel}>Quantity</span>
              <div style={qtyControls}>
                <button
                  type="button"
                  style={qtyBtn}
                  onClick={() => onPrintsQtyChange?.(Math.max(1, printsQty - 1))}
                >
                  <span style={qtySymbol}>−</span>
                </button>
                <span style={qtyValue}>{printsQty}</span>
                <button
                  type="button"
                  style={qtyBtn}
                  onClick={() => onPrintsQtyChange?.(printsQty + 1)}
                >
                  <span style={qtySymbol}>+</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Total */}
        {printsQty > 0 && (
          <div style={totalRow}>
            <span style={totalLabel}>Total</span>
            <span style={totalValue}>{fmt(WB_GALLERY_PRICE + printsQty * WB_PRINTS_PRICE)}</span>
          </div>
        )}

        <Button onClick={onNext}>Continue</Button>
      </div>
    );
  }

  /* ── Standard developing flow ── */
  return (
    <div style={container}>
      <BackButton onClick={onBack} />

      <h1 style={headline}>
        How do you want{"\n"}your photos?
      </h1>

      <div style={cards}>
        {STANDARD_OPTIONS.map((opt) => {
          const selected = format === opt.id;
          const hasDiscount = discountPct && discountPct > 0;
          const salePrice = hasDiscount
            ? opt.price * (1 - discountPct / 100)
            : null;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(opt.id)}
              style={{
                ...card,
                backgroundColor: selected
                  ? "var(--color-selected)"
                  : "var(--color-bg)",
                borderColor: "var(--color-border)",
              }}
            >
              <span style={cardLabel}>{opt.label}</span>
              {salePrice != null ? (
                <span style={cardPriceWrap}>
                  <span style={cardPriceSale}>{fmt(salePrice)}</span>
                  <span style={cardBadge}>-{discountPct}%</span>
                </span>
              ) : (
                <span style={cardPrice}>{fmt(opt.price)}</span>
              )}
            </button>
          );
        })}
      </div>

      <Button onClick={onNext} disabled={!format}>
        Continue
      </Button>
    </div>
  );
}

/* ── Styles ── */

const container: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  padding: `0 var(--page-padding)`,
};

const headline: CSSProperties = {
  fontFamily: "var(--font-headline)",
  fontSize: 40,
  fontWeight: 400,
  lineHeight: 1.06,
  whiteSpace: "pre-line",
  color: "var(--color-text)",
  margin: 0,
  marginTop: 24,
  marginBottom: 24,
};

const cards: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 18,
  marginBottom: 28,
};

const card: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  height: "var(--card-height)",
  borderRadius: "var(--radius-card)",
  border: "1px solid",
  padding: "0 28px",
  cursor: "pointer",
  transition: "background-color var(--transition-fast)",
  WebkitTapHighlightColor: "transparent",
};

const cardLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 25,
  color: "var(--color-text)",
};

const cardPrice: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 20,
  color: "var(--color-text)",
};

const cardPriceWrap: CSSProperties = {
  display: "flex",
  alignItems: "baseline",
  gap: 8,
};

const cardPriceSale: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 20,
  color: "var(--color-text)",
};

const cardBadge: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  fontWeight: 600,
  color: "var(--color-text)",
  backgroundColor: "var(--color-selected)",
  borderRadius: 6,
  padding: "2px 7px",
  position: "relative",
  top: -1,
};

const addonSection: CSSProperties = {
  marginTop: 18,
  marginBottom: 24,
};

const addonLeft: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 14,
  position: "relative",
  top: -1,
};

const checkbox: CSSProperties = {
  width: 22,
  height: 22,
  borderRadius: 6,
  border: "2px solid var(--color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const checkboxFill: CSSProperties = {
  width: 12,
  height: 12,
  borderRadius: 3,
  backgroundColor: "var(--color-text)",
};

const qtyRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "14px 28px 0",
};

const qtyLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
};

const qtyControls: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16,
};

const qtyBtn: CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: "50%",
  border: "1px solid var(--color-border)",
  backgroundColor: "var(--color-bg)",
  color: "var(--color-text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  WebkitTapHighlightColor: "transparent",
};

const qtySymbol: CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
  display: "block",
  transform: "translateY(-2px)",
};

const qtyValue: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 20,
  color: "var(--color-text)",
  minWidth: 24,
  textAlign: "center",
};

const totalRow: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "0 4px",
  marginBottom: 20,
};

const totalLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 18,
  color: "var(--color-text)",
};

const totalValue: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 18,
  fontWeight: 600,
  color: "var(--color-text)",
};
