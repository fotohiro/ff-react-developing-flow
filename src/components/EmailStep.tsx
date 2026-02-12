import { useEffect, useRef, useState, type CSSProperties } from "react";
import Button from "./Button";

interface Props {
  cid: string;
  email: string;
  onChange: (email: string) => void;
  onNext: () => void;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function EmailStep({ cid, email, onChange, onNext }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [touched, setTouched] = useState(false);

  const isValid = EMAIL_RE.test(email);
  const showError = touched && email.length > 0 && !isValid;

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) onNext();
  };

  return (
    <form onSubmit={handleSubmit} style={container}>
      {/* Smiley icon */}
      <div style={iconWrap}>
        <img
          src="/fotofoto-smiley.svg"
          alt="FOTOFOTO"
          style={{ width: 53, height: 53 }}
        />
      </div>

      {/* Headline */}
      <h1 style={headline}>
        Let's develop{"\n"}your film.
      </h1>

      {/* Camera ID */}
      <p style={cameraId}>Camera #{cid}</p>

      {/* Email input */}
      <div style={inputWrap}>
        <input
          ref={inputRef}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => setTouched(true)}
          style={{
            ...input,
            borderColor: showError
              ? "var(--color-error)"
              : "var(--color-border)",
          }}
        />
        {showError && (
          <p style={errorText}>
            That doesn't look right — check your email
          </p>
        )}
      </div>

      {/* Continue */}
      <Button type="submit" disabled={!isValid}>
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

const cameraId: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--color-text-secondary)",
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
