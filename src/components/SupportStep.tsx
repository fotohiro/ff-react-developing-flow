import { useEffect, useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";

interface Props {
  labName: string;
  chatUrl: string;
  onBack: () => void;
}

/** Optional help screen, opened from the "Need help?" link: WhatsApp chat with the market's lab. */
export default function SupportStep({ labName, chatUrl, onBack }: Props) {
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("qrcode")
      .then((QRCode) => QRCode.toDataURL(chatUrl, { margin: 1, width: 440 }))
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [chatUrl]);

  const openChat = () => {
    if (!window.open(chatUrl, "_blank", "noopener,noreferrer")) window.location.href = chatUrl;
  };

  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Need a hand?</h1>
      <p style={bodyText}>
        Questions about your return, camera or order? Message {labName}, our lab in Malaysia,
        on WhatsApp.
      </p>

      <Button onClick={openChat}>Open WhatsApp</Button>

      {qr && (
        <>
          <p style={orText}>OR SCAN FROM ANOTHER PHONE</p>
          <img src={qr} alt={`WhatsApp QR code for ${labName}`} style={qrImg} />
        </>
      )}

      <button type="button" style={returnLink} onClick={onBack}>
        Back to developing
      </button>
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
  marginBottom: 24,
  lineHeight: 1.4,
};

const orText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  letterSpacing: "0.08em",
  color: "var(--color-text-secondary)",
  textAlign: "center",
  margin: "28px 0 14px",
};

const returnLink: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textDecoration: "underline",
  background: "none",
  border: "none",
  cursor: "pointer",
  marginTop: 28,
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};

const qrImg: CSSProperties = {
  width: 200,
  height: 200,
  alignSelf: "center",
  borderRadius: "var(--radius-card)",
};
