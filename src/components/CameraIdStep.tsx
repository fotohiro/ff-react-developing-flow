import { useEffect, useRef, useState, type CSSProperties } from "react";
import Button from "./Button";
import { normalizeCid } from "../lib/params";

interface Props {
  onSubmit: (cid: string) => void;
}

export default function CameraIdStep({ onSubmit }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const cid = normalizeCid(value);
  const showError = touched && value.length > 0 && !cid;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (cid) onSubmit(cid);
  };

  return (
    <form onSubmit={handleSubmit} style={container}>
      <div style={iconWrap}>
        <img src="/fotofoto-smiley.svg" alt="FOTOFOTO" style={{ width: 53, height: 53 }} />
      </div>

      <h1 style={headline}>Which camera{"\n"}is this?</h1>

      <p style={subtext}>
        Scan the QR code on your camera again, or type the number printed next to it.
      </p>

      <div style={inputWrap}>
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="Camera number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          style={{
            ...input,
            borderColor: showError ? "var(--color-error)" : "var(--color-border)",
          }}
        />
        {showError && <p style={errorText}>That doesn't look like a camera number</p>}
      </div>

      <Button type="submit" disabled={!cid}>
        Continue
      </Button>
    </form>
  );
}

const container: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: `0 var(--page-padding)`,
};

const iconWrap: CSSProperties = {
  marginTop: 28,
  marginBottom: 20,
};

const headline: CSSProperties = {
  fontFamily: "var(--font-headline)",
  fontSize: 50,
  fontWeight: 400,
  lineHeight: 1.06,
  textAlign: "center",
  whiteSpace: "pre-line",
  color: "var(--color-text)",
  margin: 0,
};

const subtext: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--color-text-secondary)",
  textAlign: "center",
  maxWidth: "var(--content-width)",
  marginTop: 16,
  marginBottom: 28,
};

const inputWrap: CSSProperties = {
  width: "100%",
  maxWidth: "var(--content-width)",
  marginBottom: 24,
};

const input: CSSProperties = {
  width: "100%",
  height: "var(--input-height)",
  borderRadius: "var(--radius-input)",
  border: "1px solid var(--color-border)",
  padding: "0 24px",
  fontSize: 20,
  fontFamily: "var(--font-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
  transition: "border-color var(--transition-fast)",
};

const errorText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 13,
  color: "var(--color-error)",
  marginTop: 8,
  paddingLeft: 4,
};
