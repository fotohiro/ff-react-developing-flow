import { type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { usePricing } from "../lib/pricing";
import { boxTotals, needsChoice, type Box, type BoxChoice, type BoxOffer } from "../lib/boxes";

interface Props {
  offer: Extract<BoxOffer, { kind: "boxes" }>;
  choice: BoxChoice | null;
  onChoose: (choice: BoxChoice) => void;
  onNext: () => void;
  /** Omitted when this is the first step. */
  onBack?: () => void;
}

const count = (n: number) => `${n} box${n === 1 ? "" : "es"}`;

/** Shown when a camera's Wedding Box shipped with others: which boxes this checkout pays for. */
export default function BoxStep({ offer, choice, onChoose, onNext, onBack }: Props) {
  const { prices, formatPrice } = usePricing();
  const price = (boxes: Box[]) => {
    const { gallery } = boxTotals(boxes, 0, prices);
    return gallery > 0 ? formatPrice(gallery) : "Free";
  };
  const { base, all } = offer;
  const pick = needsChoice(offer);
  const scannedPaid = base.length === 0;
  const mixed = base.length > 1;

  const options: { id: BoxChoice; label: string; boxes: Box[] }[] = [
    { id: "all", label: `All ${count(all.length)}`, boxes: all },
    { id: "base", label: base.length === 1 ? "Just this box" : `These ${count(base.length)}`, boxes: base },
  ];

  return (
    <div style={container}>
      {onBack && <BackButton onClick={onBack} />}

      <h1 style={headline}>
        {scannedPaid
          ? "This box is\nalready paid for."
          : pick
            ? "Which boxes are\nwe developing?"
            : "Your boxes came\nback together."}
      </h1>

      {scannedPaid && (
        <p style={body}>
          {all.length === 1
            ? "Your other Wedding Box still needs developing."
            : `Your other ${count(all.length)} still need developing.`}
        </p>
      )}
      {mixed && (
        <p style={body}>
          Cameras from {count(base.length)} arrived mixed together, so we develop those boxes together.
        </p>
      )}

      {pick ? (
        <div style={cards}>
          {options.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChoose(opt.id)}
              style={{ ...card, cursor: "pointer", backgroundColor: choice === opt.id ? "var(--color-selected)" : "var(--color-bg)" }}
            >
              <span style={cardLabel}>{opt.label}</span>
              <span style={cardPrice}>{price(opt.boxes)}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ ...card, backgroundColor: "var(--color-selected)", marginBottom: 28 }}>
          <span style={cardLabel}>{count(all.length)}</span>
          <span style={cardPrice}>{price(all)}</span>
        </div>
      )}

      <Button onClick={onNext} disabled={pick && choice === null}>
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
  marginBottom: 18,
};

const body: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  lineHeight: 1.4,
  color: "var(--color-text-muted)",
  margin: 0,
  marginBottom: 18,
};

/* Cards match FormatStep. */
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
  border: "1px solid var(--color-border)",
  padding: "0 28px",
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
