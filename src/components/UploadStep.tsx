import { useRef, useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { requestReplacementLabel } from "../lib/api";

interface Props {
  cid: string;
  email: string;
  labelImg: string | null;
  onCapture: (dataUrl: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function UploadStep({
  cid,
  email,
  labelImg,
  onCapture,
  onNext,
  onBack,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track how the label was obtained
  const [labelSource, setLabelSource] = useState<"camera" | "replacement" | null>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setLabelSource("camera");
        setError(null);
        onCapture(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleReplacementLabel = async () => {
    setGenerating(true);
    setError(null);
    try {
      const { labelUrl } = await requestReplacementLabel(cid, email);
      setLabelSource("replacement");
      onCapture(labelUrl);
    } catch {
      setError("Something went wrong generating your label. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const retake = () => {
    onCapture(""); // Clear
    setLabelSource(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ── Pre-capture state ── */
  if (!labelImg) {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />
        <h1 style={headline}>Photo your return label.</h1>

        {/* Drop zone */}
        <button
          type="button"
          style={dropZone}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          {generating ? (
            <div style={spinnerWrap}>
              <div style={spinner} />
              <span style={spinnerText}>Generating new label...</span>
            </div>
          ) : (
            <>
              <span style={dropLabel}>Tap to take photo.</span>
              <span style={dropSub}>or drop an image</span>
            </>
          )}
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        {/* Hint pill */}
        <div style={hintPill}>
          <span>💡</span>
          <span style={hintText}>It's folded inside your return mailer</span>
        </div>

        {/* Error message */}
        {error && <p style={errorMsg}>{error}</p>}

        {/* Can't find it? */}
        <button
          type="button"
          style={cantFindBtn}
          onClick={handleReplacementLabel}
          disabled={generating}
        >
          {error ? "Try again" : "Can't find it?"}
        </button>
        {!error && !generating && (
          <p style={cantFindHint}>We'll generate a new one.</p>
        )}
      </div>
    );
  }

  /* ── Post-capture state ── */
  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Photo your return label.</h1>

      {/* Image preview */}
      <div style={previewWrap}>
        <img src={labelImg} alt="Return label" style={previewImg} />
        <div style={capturedBadge}>
          {labelSource === "replacement" ? "Generated" : "Captured"}
        </div>
      </div>

      {/* Email confirmation — only for replacement labels */}
      {labelSource === "replacement" && (
        <p style={emailSentText}>
          A copy has also been sent to your email.
        </p>
      )}

      {/* Retake */}
      <button type="button" style={retakeBtn} onClick={retake}>
        Retake
      </button>

      <Button onClick={onNext}>Continue</Button>
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

/* Drop zone */
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

/* Spinner for replacement label generation */
const spinnerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
};

const spinner: CSSProperties = {
  width: 28,
  height: 28,
  border: "3px solid var(--color-border-light)",
  borderTopColor: "var(--color-progress-filled)",
  borderRadius: "50%",
  animation: "spin 0.8s linear infinite",
};

const spinnerText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-secondary)",
};

/* Hint pill */
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

/* Can't find it hint */
const cantFindHint: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-text-secondary)",
  textAlign: "center",
  marginTop: 6,
};

/* Error message */
const errorMsg: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-error)",
  textAlign: "center",
  marginTop: 16,
};

/* Can't find it link */
const cantFindBtn: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textDecoration: "underline",
  background: "none",
  border: "none",
  cursor: "pointer",
  marginTop: 14,
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};

/* Preview */
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

const capturedBadge: CSSProperties = {
  position: "absolute",
  top: 14,
  right: 14,
  backgroundColor: "var(--color-success)",
  color: "#ffffff",
  fontFamily: "var(--font-body)",
  fontSize: 16,
  height: 34,
  paddingLeft: 18,
  paddingRight: 18,
  borderRadius: "var(--radius-badge)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const emailSentText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-text-secondary)",
  textAlign: "center",
  marginTop: 12,
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
  marginBottom: 18,
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};
