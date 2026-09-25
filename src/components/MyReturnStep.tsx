import { type CSSProperties } from "react";
import BackButton from "./BackButton";

interface Props {
  cid: string;
  onBack: () => void;
}

const CONTACT_EMAIL = "hello@fotofoto.io";

/** Malaysia returns go to the partner lab; until that return method exists, customers contact us. */
export default function MyReturnStep({ cid, onBack }: Props) {
  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Developing in{"\n"}Malaysia.</h1>
      <p style={bodyText}>
        We're still setting up returns to our Malaysian lab.
        Reach out and we'll sort out your developing by hand.
      </p>
      <a
        href={`mailto:${CONTACT_EMAIL}?subject=Malaysia%20developing%20(camera%20${cid})`}
        style={contactLink}
      >
        {CONTACT_EMAIL}
      </a>
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

const bodyText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  marginTop: 0,
  marginBottom: 18,
  lineHeight: 1.4,
};

const contactLink: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 18,
  color: "var(--color-text)",
  textDecoration: "underline",
  alignSelf: "flex-start",
};
