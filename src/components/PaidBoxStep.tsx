import { type CSSProperties } from "react";

const CONTACT_EMAIL = "hello@fotofoto.io";

/** Replaces the wizard when every Wedding Box on the order is already paid for. */
export default function PaidBoxStep() {
  return (
    <div style={container}>
      <h1 style={headline}>You're all set.</h1>
      <p style={body}>
        Developing for this Wedding Box is already paid for, so there's nothing to check out.
        We'll email you when your photos are ready.
      </p>
      <p style={body}>
        Questions? <a href={`mailto:${CONTACT_EMAIL}`} style={link}>{CONTACT_EMAIL}</a>
      </p>
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
  color: "var(--color-text)",
  margin: 0,
  marginTop: 48,
  marginBottom: 18,
};

const body: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  lineHeight: 1.4,
  color: "var(--color-text-muted)",
  margin: 0,
  marginBottom: 14,
};

const link: CSSProperties = {
  color: "var(--color-text)",
};
