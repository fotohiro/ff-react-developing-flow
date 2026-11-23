import { useMemo, useRef, useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { isInAppBrowser } from "../lib/isWebView";

type Phase = "select" | "lost" | "capture";

interface Props {
  labelImg: string | null;
  labelTracking: string | null;
  onCapture: (dataUrl: string) => void;
  onLabelSourceChange: (source: "camera" | "replacement" | null) => void;
  onTrackingChange: (tracking: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

const LAB_ADDRESS = [
  "Nova Experientia Sdn Bhd",
  "Lot 8, Jln Industri 3/2",
  "Taman Industri Integrasi Rawang",
  "48000 Rawang, Selangor",
  "Tel: 03-6091 5836",
];

// DHL eCommerce consignment numbers, e.g. MCN000000069243.
const CONSIGNMENT_RE = /^[A-Z0-9]{10,20}$/;
const normalizeConsignment = (value: string) => value.replace(/\s+/g, "").toUpperCase();

/** Malaysia returns ship by DHL eCommerce to the partner lab in Rawang, on the slip packed in the mailer. */
export default function MyReturnStep({
  labelImg,
  labelTracking,
  onCapture,
  onLabelSourceChange,
  onTrackingChange,
  onNext,
  onBack,
}: Props) {
  const inApp = useMemo(() => isInAppBrowser(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>(labelImg ? "capture" : "select");
  const [lostSlip, setLostSlip] = useState(false);
  const [consignment, setConsignment] = useState(labelTracking ?? "");

  const normalized = normalizeConsignment(consignment);
  const consignmentValid = CONSIGNMENT_RE.test(normalized);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLabelSourceChange("camera");
        onCapture(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const retake = () => {
    onCapture("");
    onLabelSourceChange(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleContinue = () => {
    if (!labelImg || !consignmentValid) return;
    onTrackingChange(normalized);
    onNext();
  };

  /* ── Select ── */
  if (phase === "select") {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />
        <h1 style={headline}>Get your DHL return slip.</h1>

        <button
          type="button"
          style={choiceBtn}
          onClick={() => {
            setLostSlip(false);
            setPhase("capture");
          }}
        >
          I have my slip.
        </button>

        <div style={hintPill}>
          <span aria-hidden>💡</span>
          <span style={hintText}>It's folded inside your return mailer</span>
        </div>

        <p style={orText}>OR</p>

        <button
          type="button"
          style={choiceBtn}
          onClick={() => {
            setLostSlip(true);
            setPhase("lost");
          }}
        >
          I lost my slip.
        </button>
      </div>
    );
  }

  /* ── Lost slip: fill out a blank one at the counter ── */
  if (phase === "lost") {
    return (
      <div style={container}>
        <BackButton onClick={() => setPhase("select")} />
        <h1 style={headline}>Use a blank{"\n"}DHL slip.</h1>
        <p style={bodyText}>
          Ask for a DHL eCommerce domestic slip at any DHL ServicePoint and send
          your camera to our lab:
        </p>

        <div style={addressCard}>
          {LAB_ADDRESS.map((line) => (
            <span key={line} style={addressLine}>
              {line}
            </span>
          ))}
        </div>

        <Button onClick={() => setPhase("capture")}>Continue</Button>
      </div>
    );
  }

  /* ── Capture: slip photo + consignment number ── */
  return (
    <div style={container}>
      <BackButton onClick={() => setPhase(lostSlip ? "lost" : "select")} />
      <h1 style={headline}>Photo your DHL slip.</h1>
      <p style={bodyText}>
        Fill in your name, address and phone in the Sender box first.
      </p>

      {labelImg ? (
        <>
          <div style={previewWrap}>
            <img src={labelImg} alt="DHL return slip" style={previewImg} />
          </div>
          <button type="button" style={retakeBtn} onClick={retake}>
            Retake
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            style={dropZone}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
          >
            <span style={dropLabel}>
              {inApp ? "Select from photos." : "Tap to take photo."}
            </span>
            <span style={dropSub}>
              {inApp
                ? "Take a photo of your slip first, then select it here."
                : "or drop an image"}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            {...(!inApp ? { capture: "environment" as const } : {})}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
            style={{ display: "none" }}
          />
        </>
      )}

      <label style={fieldLabel} htmlFor="dhl-consignment">
        Consignment number
      </label>
      <input
        id="dhl-consignment"
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="MCN000000000000"
        value={consignment}
        onChange={(e) => setConsignment(e.target.value)}
        style={formInput}
      />
      <p style={fieldHint}>Printed under the barcode at the top of the slip.</p>
      {consignment.trim() !== "" && !consignmentValid && (
        <p style={errorMsg}>That doesn't look like a DHL consignment number.</p>
      )}

      <Button
        onClick={handleContinue}
        disabled={!labelImg || !consignmentValid}
        style={{ margin: "24px auto 0" }}
      >
        Continue
      </Button>

      <p style={footnote}>After checkout, drop your mailer at any DHL ServicePoint.</p>
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

const choiceBtn: CSSProperties = {
  width: "100%",
  minHeight: 72,
  borderRadius: "var(--radius-card)",
  border: "1px solid var(--color-border)",
  background: "var(--color-bg)",
  fontFamily: "var(--font-body)",
  fontSize: 22,
  color: "var(--color-text)",
  cursor: "pointer",
  WebkitTapHighlightColor: "transparent",
};

const hintPill: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 6,
  height: 40,
  borderRadius: "var(--radius-badge)",
  backgroundColor: "var(--color-hint-bg)",
  padding: "0 20px",
  marginTop: 14,
  alignSelf: "stretch",
};

const hintText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
};

const orText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  letterSpacing: "0.08em",
  color: "var(--color-text-secondary)",
  textAlign: "center",
  margin: "18px 0",
};

const addressCard: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  backgroundColor: "var(--color-surface)",
  borderRadius: "var(--radius-card)",
  padding: "16px 24px",
  marginBottom: 24,
  userSelect: "text",
};

const addressLine: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text)",
  lineHeight: 1.4,
};

const dropZone: CSSProperties = {
  width: "100%",
  height: 168,
  borderRadius: "var(--radius-card)",
  border: "1px dashed var(--color-border)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  cursor: "pointer",
  background: "none",
  WebkitTapHighlightColor: "transparent",
  transition: "border-color var(--transition-fast)",
};

const dropLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 25,
  color: "var(--color-text)",
};

const dropSub: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 18,
  color: "var(--color-text-muted)",
};

const previewWrap: CSSProperties = {
  position: "relative",
  width: "100%",
  height: 168,
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
};

const previewImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  borderRadius: "var(--radius-card)",
};

const retakeBtn: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textDecoration: "underline",
  background: "none",
  border: "none",
  cursor: "pointer",
  marginTop: 12,
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};

const fieldLabel: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text)",
  marginTop: 24,
  marginBottom: 8,
};

const formInput: CSSProperties = {
  width: "100%",
  height: 50,
  borderRadius: "var(--radius-input)",
  border: "1px solid var(--color-border)",
  padding: "0 16px",
  fontSize: 16,
  fontFamily: "var(--font-body)",
  color: "var(--color-text)",
  backgroundColor: "var(--color-bg)",
  transition: "border-color var(--transition-fast)",
  boxSizing: "border-box",
  WebkitAppearance: "none",
  appearance: "none" as CSSProperties["appearance"],
  letterSpacing: "0.04em",
};

const fieldHint: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-text-secondary)",
  marginTop: 8,
  marginBottom: 0,
};

const errorMsg: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-error)",
  marginTop: 6,
  marginBottom: 0,
};

const footnote: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-text-secondary)",
  textAlign: "center",
  marginTop: 10,
};
