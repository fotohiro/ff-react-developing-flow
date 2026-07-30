import { useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import UploadStep from "./UploadStep";
import { requestReturnQr, trackEvent, type CustomerAddress } from "../lib/api";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
  "DC","PR","VI","GU","AS","MP",
];

type Phase = "select" | "upload" | "address" | "qr";

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

export default function ReturnLabelStep({
  cid,
  email,
  labelImg,
  onCapture,
  onLabelSourceChange,
  onTrackingChange,
  onNext,
  onBack,
}: Props) {
  const [phase, setPhase] = useState<Phase>("select");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [address, setAddress] = useState<CustomerAddress>({
    name: "",
    street1: "",
    city: "",
    state: "",
    zip: "",
    phone: "",
  });

  const updateField = (field: keyof CustomerAddress, value: string) => {
    setAddress((prev) => ({ ...prev, [field]: value }));
  };

  const phoneDigits = address.phone.replace(/\D/g, "");
  const isFormValid =
    address.name.trim().length > 0 &&
    address.street1.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.state.length > 0 &&
    /^\d{5}$/.test(address.zip.trim()) &&
    phoneDigits.length >= 10;

  const chooseHaveLabel = () => {
    trackEvent("Chose Existing Label", email, { cid, email });
    setPhase("upload");
  };

  const chooseNeedLabel = () => {
    trackEvent("Chose New Label", email, { cid, email });
    setPhase("address");
  };

  const generateQr = async () => {
    setGenerating(true);
    setError(null);
    try {
      const result = await requestReturnQr(cid, email, {
        ...address,
        name: address.name.trim(),
        street1: address.street1.trim(),
        city: address.city.trim(),
        zip: address.zip.trim(),
        phone: phoneDigits.slice(-10),
      });
      setQrCodeUrl(result.qrCodeUrl);
      onLabelSourceChange("replacement");
      onCapture(result.qrCodeUrl);
      onTrackingChange(result.trackingNumber);

      trackEvent("Label Generated", email, {
        cid,
        email,
        qrCodeUrl: result.qrCodeUrl,
        labelUrl: result.labelUrl,
        trackingNumber: result.trackingNumber,
        kind: "usps_label_broker_qr",
      });
      setPhase("qr");
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Something went wrong generating your QR. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleAddressSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !generating) void generateQr();
  };

  /* ── Select ── */
  if (phase === "select") {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />
        <h1 style={headline}>Get your return label.</h1>

        <button type="button" style={choiceBtn} onClick={chooseHaveLabel}>
          I have my label.
        </button>

        <div style={hintPill}>
          <span aria-hidden>💡</span>
          <span style={hintText}>It's folded inside your return mailer</span>
        </div>

        <p style={orText}>OR</p>

        <button type="button" style={choiceBtn} onClick={chooseNeedLabel}>
          I need a new label.
        </button>
      </div>
    );
  }

  /* ── Photo existing label ── */
  if (phase === "upload") {
    return (
      <UploadStep
        cid={cid}
        email={email}
        labelImg={labelImg}
        onCapture={onCapture}
        onLabelSourceChange={onLabelSourceChange}
        onTrackingChange={onTrackingChange}
        onNext={onNext}
        onBack={() => {
          onCapture("");
          onLabelSourceChange(null);
          onTrackingChange(null);
          setPhase("select");
        }}
      />
    );
  }

  /* ── Address → generate ── */
  if (phase === "address") {
    return (
      <div style={container}>
        <BackButton
          onClick={() => {
            setError(null);
            setPhase("select");
          }}
        />
        <h1 style={headline}>Enter your shipping info.</h1>

        {generating ? (
          <div style={spinnerWrap}>
            <div style={spinner} />
            <span style={spinnerText}>Creating your return QR...</span>
          </div>
        ) : (
          <form onSubmit={handleAddressSubmit} style={formWrap}>
            <input
              type="text"
              placeholder="Name"
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
              placeholder="City"
              autoComplete="address-level2"
              value={address.city}
              onChange={(e) => updateField("city", e.target.value)}
              style={formInput}
            />
            <input
              type="text"
              placeholder="State"
              autoComplete="address-level1"
              maxLength={2}
              value={address.state}
              onChange={(e) =>
                updateField("state", e.target.value.replace(/[^a-zA-Z]/g, "").toUpperCase().slice(0, 2))
              }
              list="ff-us-states"
              style={formInput}
            />
            <datalist id="ff-us-states">
              {US_STATES.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <input
              type="text"
              inputMode="numeric"
              placeholder="ZIP"
              autoComplete="postal-code"
              maxLength={5}
              value={address.zip}
              onChange={(e) =>
                updateField("zip", e.target.value.replace(/\D/g, "").slice(0, 5))
              }
              style={formInput}
            />
            <input
              type="tel"
              inputMode="tel"
              placeholder="Phone"
              autoComplete="tel"
              value={address.phone}
              onChange={(e) => updateField("phone", e.target.value)}
              style={formInput}
            />

            {error && <p style={errorMsg}>{error}</p>}

            <div style={{ marginTop: 14, alignSelf: "center", width: "100%", display: "flex", justifyContent: "center" }}>
              <Button type="submit" disabled={!isFormValid}>
                Continue
              </Button>
            </div>
          </form>
        )}
      </div>
    );
  }

  /* ── QR display ── */
  return (
    <div style={container}>
      <BackButton
        onClick={() => {
          onCapture("");
          onLabelSourceChange(null);
          onTrackingChange(null);
          setQrCodeUrl(null);
          setPhase("address");
        }}
      />
      <h1 style={headline}>Bring this QR code to the Post Office.</h1>

      <div style={qrFrame}>
        {qrCodeUrl ? (
          <img src={qrCodeUrl} alt="USPS return QR code" style={qrImg} />
        ) : null}
      </div>

      <p style={bodyText}>
        Show this code. USPS will scan, print your label, and take your package.
      </p>

      <p style={emailNotice}>💡 A copy will be sent to your email.</p>

      <div style={{ alignSelf: "center", width: "100%", display: "flex", justifyContent: "center" }}>
        <Button onClick={onNext}>Continue</Button>
      </div>
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

const spinnerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 12,
  padding: "40px 0",
  minHeight: 200,
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

const errorMsg: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-error)",
  textAlign: "center",
  marginTop: 8,
};

const qrFrame: CSSProperties = {
  width: "100%",
  aspectRatio: "1",
  maxWidth: 320,
  alignSelf: "center",
  borderRadius: "var(--radius-card)",
  border: "1px dashed var(--color-border)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  overflow: "hidden",
  padding: 16,
  boxSizing: "border-box",
};

const qrImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const bodyText: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  lineHeight: 1.4,
  color: "var(--color-text-muted)",
  textAlign: "center",
  marginTop: 18,
  marginBottom: 0,
};

const emailNotice: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textAlign: "center",
  marginTop: 14,
  marginBottom: 24,
};
