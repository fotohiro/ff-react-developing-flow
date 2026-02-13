import { useRef, useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { requestReplacementLabel, trackEvent } from "../lib/api";
import type { CustomerAddress } from "../lib/api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC","PR","VI","GU","AS","MP",
];

interface Props {
  cid: string;
  email: string;
  labelImg: string | null;
  onCapture: (dataUrl: string) => void;
  onLabelSourceChange: (source: "camera" | "replacement" | null) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function UploadStep({
  cid,
  email,
  labelImg,
  onCapture,
  onLabelSourceChange,
  onNext,
  onBack,
}: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [labelSource, setLabelSourceLocal] = useState<"camera" | "replacement" | null>(null);

  const setLabelSource = (source: "camera" | "replacement" | null) => {
    setLabelSourceLocal(source);
    onLabelSourceChange(source);
  };

  // Address form state
  const [showForm, setShowForm] = useState(false);
  const [address, setAddress] = useState<CustomerAddress>({
    name: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip: "",
  });

  const updateField = (field: keyof CustomerAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const isFormValid =
    address.name.trim().length > 0 &&
    address.street1.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.state.length > 0 &&
    /^\d{5}$/.test(address.zip.trim());

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
      const { labelUrl } = await requestReplacementLabel(cid, email, {
        ...address,
        name: address.name.trim(),
        street1: address.street1.trim(),
        street2: address.street2?.trim() || undefined,
        city: address.city.trim(),
        zip: address.zip.trim(),
      });
      setLabelSource("replacement");
      onCapture(labelUrl);

      // Fire Klaviyo event for label email flow
      trackEvent("Label Generated", email, { cid, labelUrl });
    } catch {
      setError("Something went wrong generating your label. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !generating) handleReplacementLabel();
  };

  const retake = () => {
    onCapture("");
    setLabelSource(null);
    setError(null);
    setShowForm(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  /* ── Pre-capture: Address form ── */
  if (!labelImg && showForm) {
    return (
      <div style={container}>
        <BackButton onClick={() => setShowForm(false)} />
        <h1 style={headline}>Enter your{"\n"}address.</h1>

        {generating ? (
          <div style={{ ...dropZone, height: "auto", minHeight: 168, border: "none" }}>
            <div style={spinnerWrap}>
              <div style={spinner} />
              <span style={spinnerText}>Generating your label...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleFormSubmit} style={formWrap}>
            <input
              type="text"
              placeholder="Full name"
              autoComplete="name"
              value={address.name}
              onChange={(e) => updateField("name", e.target.value)}
              style={formInput}
            />
            <input
              type="text"
              placeholder="Street address"
              autoComplete="address-line1"
              value={address.street1}
              onChange={(e) => updateField("street1", e.target.value)}
              style={formInput}
            />
            <input
              type="text"
              placeholder="Apt / Suite (optional)"
              autoComplete="address-line2"
              value={address.street2 ?? ""}
              onChange={(e) => updateField("street2", e.target.value)}
              style={formInput}
            />
            <div style={formRow}>
              <input
                type="text"
                placeholder="City"
                autoComplete="address-level2"
                value={address.city}
                onChange={(e) => updateField("city", e.target.value)}
                style={{ ...formInput, flex: 1 }}
              />
              <select
                value={address.state}
                onChange={(e) => updateField("state", e.target.value)}
                autoComplete="address-level1"
                style={{
                  ...formInput,
                  width: 80,
                  color: address.state ? "var(--color-text)" : "var(--color-text-placeholder)",
                }}
              >
                <option value="" disabled>
                  State
                </option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Zip"
                autoComplete="postal-code"
                maxLength={5}
                value={address.zip}
                onChange={(e) =>
                  updateField("zip", e.target.value.replace(/\D/g, "").slice(0, 5))
                }
                style={{ ...formInput, width: 86 }}
              />
            </div>

            {error && <p style={errorMsg}>{error}</p>}

            <div style={{ marginTop: 14 }}>
              <Button type="submit" disabled={!isFormValid}>
                Generate Label
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  /* ── Pre-capture: Photo drop zone (default) ── */
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
          <span style={dropLabel}>Tap to take photo.</span>
          <span style={dropSub}>or drop an image</span>
        </button>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleInputChange}
          style={{ display: "none" }}
        />

        <div style={hintPill}>
          <span>💡</span>
          <span style={hintText}>It's folded inside your return mailer</span>
        </div>

        <button
          type="button"
          style={cantFindBtn}
          onClick={() => setShowForm(true)}
        >
          Can't find it?
        </button>
        <p style={cantFindHint}>We'll generate a new one.</p>
      </div>
    );
  }

  const handlePrint = () => {
    const printWindow = window.open("", "_blank");
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head><title>Return Label</title></head>
          <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;">
            <img src="${labelImg}" style="max-width:100%;max-height:100vh;" onload="window.print();window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  /* ── Post-capture state ── */
  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Your return label.</h1>

      <div style={previewWrap}>
        <img src={labelImg} alt="Return label" style={previewImg} />
        <div style={capturedBadge}>
          {labelSource === "replacement" ? "Generated" : "Captured"}
        </div>
      </div>

      {labelSource === "replacement" && (
        <>
          <button type="button" style={printBtn} onClick={handlePrint}>
            Print Label
          </button>
          <p style={emailNotice}>A copy will be sent to your email.</p>
        </>
      )}

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

/* Spinner */
const spinnerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: "40px 0",
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

const cantFindHint: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-text-secondary)",
  textAlign: "center",
  marginTop: 6,
};

const errorMsg: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-error)",
  textAlign: "center",
  marginTop: 8,
};

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

/* Address form */
const formWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  width: "100%",
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
};

const formRow: CSSProperties = {
  display: "flex",
  gap: 8,
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

const printBtn: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text)",
  backgroundColor: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-button)",
  padding: "10px 24px",
  cursor: "pointer",
  alignSelf: "center",
  marginTop: 14,
  WebkitTapHighlightColor: "transparent",
};

const emailNotice: CSSProperties = {
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
