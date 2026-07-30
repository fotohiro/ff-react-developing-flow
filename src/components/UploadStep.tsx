import { useMemo, useRef, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { isInAppBrowser } from "../lib/isWebView";

interface Props {
  cid: string;
  email: string;
  labelImg: string | null;
  onCapture: (dataUrl: string) => void;
  onLabelSourceChange: (source: "camera" | "replacement" | null) => void;
  onTrackingChange: (tracking: string | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function UploadStep({
  labelImg,
  onCapture,
  onLabelSourceChange,
  onTrackingChange,
  onNext,
  onBack,
}: Props) {
  const inApp = useMemo(() => isInAppBrowser(), []);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        onLabelSourceChange("camera");
        onCapture(reader.result);
        onTrackingChange(null);
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

  const retake = () => {
    onCapture("");
    onTrackingChange(null);
    onLabelSourceChange(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!labelImg) {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />
        <h1 style={headline}>Photo your return label.</h1>

        <button
          type="button"
          style={dropZone}
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <span style={dropLabel}>
            {inApp ? "Select from photos." : "Tap to take photo."}
          </span>
          <span style={dropSub}>
            {inApp
              ? "Take a photo of your label first, then select it here."
              : "or drop an image"}
          </span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          {...(!inApp ? { capture: "environment" as const } : {})}
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        <div style={hintPill}>
          <span aria-hidden>💡</span>
          <span style={hintText}>It's folded inside your return mailer</span>
        </div>
      </div>
    );
  }

  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Your return label.</h1>

      <div style={previewWrap}>
        <img src={labelImg} alt="Return label" style={previewImg} />
      </div>

      <button type="button" style={retakeBtn} onClick={retake}>
        Retake
      </button>
      <Button onClick={onNext}>Continue</Button>
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
  marginBottom: 18,
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};
