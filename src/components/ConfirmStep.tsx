import { useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { createCart, trackEvent } from "../lib/api";
import type { FormatType } from "./FormatStep";

interface Props {
  cid: string;
  email: string;
  format: FormatType;
  labelImg: string | null;
  labelToken: string | null;
  labelSource: "camera" | "replacement" | null;
  onBack: () => void;
}

const FORMAT_LABELS: Record<FormatType, { label: string; price: string }> = {
  scans: { label: "Digital Scans", price: "$9.99" },
  prints: { label: "Prints + Scans", price: "$16.99" },
};

export default function ConfirmStep({
  cid,
  email,
  format,
  labelImg,
  labelToken,
  labelSource,
  onBack,
}: Props) {
  const [loading, setLoading] = useState(false);
  const info = FORMAT_LABELS[format];

  const handleCheckout = async () => {
    setLoading(true);
    try {
      // Create cart FIRST — only track event if this succeeds
      const checkoutUrl = await createCart({
        format,
        cid,
        email,
        ...(labelToken
          ? { labelToken }
          : { labelUrl: labelImg ?? undefined }),
      });

      // Cart created successfully — now fire Klaviyo event
      trackEvent("Completed Checkout", email, {
        cid,
        format,
        price: info.price,
        checkout_url: checkoutUrl,
        ...(labelSource === "replacement" && labelImg
          ? { labelUrl: labelImg }
          : {}),
      });

      // Same-tab redirect to Shopify checkout
      window.location.href = checkoutUrl;
    } catch (err) {
      console.error("Checkout error:", err);
      alert(
        err instanceof Error
          ? `Checkout failed: ${err.message}`
          : "Something went wrong creating checkout. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <div style={container}>
      <BackButton onClick={onBack} />

      <h1 style={headline}>Looks good?</h1>

      {/* Summary card */}
      <div style={card}>
        <div style={row}>
          <span style={rowLabel}>Camera</span>
          <span style={rowValue}>#{cid}</span>
        </div>
        <div style={divider} />
        <div style={row}>
          <span style={rowLabel}>{info.label}</span>
          <span style={rowValue}>{info.price}</span>
        </div>
        <div style={divider} />
        <div style={row}>
          <span style={rowLabel}>Email</span>
          <span style={rowValue}>{email}</span>
        </div>

        {/* Label thumbnail or "on file" */}
        {labelToken ? (
          <>
            <div style={divider} />
            <div style={row}>
              <span style={rowLabel}>Return label</span>
              <span style={{ ...rowValue, color: "var(--color-success)" }}>
                ✓ On file
              </span>
            </div>
          </>
        ) : labelImg ? (
          <div style={thumbWrap}>
            <img src={labelImg} alt="Return label" style={thumbImg} />
          </div>
        ) : null}
      </div>

      {/* Checkout */}
      <Button onClick={handleCheckout} disabled={loading}>
        {loading ? "Loading..." : "Checkout"}
      </Button>

      <p style={subtext}>Secure checkout via Shopify</p>
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
  marginTop: 20,
  marginBottom: 14,
};

const card: CSSProperties = {
  backgroundColor: "var(--color-surface)",
  borderRadius: "var(--radius-card)",
  padding: "16px 24px",
  marginBottom: 24,
};

const row: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
};

const rowLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
};

const rowValue: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textAlign: "right",
  maxWidth: "60%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const divider: CSSProperties = {
  height: 1,
  backgroundColor: "var(--color-border-light)",
};

const thumbWrap: CSSProperties = {
  marginTop: 10,
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
  height: 80,
};

const thumbImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
};

const subtext: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textAlign: "center",
  marginTop: 10,
};
