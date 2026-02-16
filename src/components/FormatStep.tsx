import { type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";

export type FormatType = "scans" | "prints";

interface Props {
  format: FormatType | null;
  discountPct?: number | null;
  onChange: (f: FormatType) => void;
  onNext: () => void;
  onBack: () => void;
}

const OPTIONS: { id: FormatType; label: string; price: number }[] = [
  { id: "scans", label: "Digital Scans", price: 9.99 },
  { id: "prints", label: "Prints + Scans", price: 16.99 },
];

const fmt = (n: number) => `$${n.toFixed(2)}`;

export default function FormatStep({ format, discountPct, onChange, onNext, onBack }: Props) {
  return (
    <div style={container}>
      <BackButton onClick={onBack} />

      <h1 style={headline}>
        How do you want{"\n"}your photos?
      </h1>

      <div style={cards}>
        {OPTIONS.map((opt) => {
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
