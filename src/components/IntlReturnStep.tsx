import { useState, type CSSProperties } from "react";
import Button from "./Button";
import BackButton from "./BackButton";
import { createReturnLabel, trackEvent, type IntlReturnAddress, type IntlReturnLabel } from "../lib/api";
import { usePricing } from "../lib/pricing";

interface Props {
  cid: string;
  email: string;
  onNext: () => void;
  onBack: () => void;
}

/** EU origins we can currently generate return labels for. */
const SUPPORTED_COUNTRIES: { code: string; label: string }[] = [
  { code: "FR", label: "France" },
  { code: "IT", label: "Italy" },
  { code: "GR", label: "Greece" },
];

const CONTACT_EMAIL = "hello@fotofoto.io";

export default function IntlReturnStep({ cid, email, onNext, onBack }: Props) {
  const { country, setCountry } = usePricing();
  const isSupported = SUPPORTED_COUNTRIES.some((c) => c.code === country);

  const [address, setAddress] = useState<IntlReturnAddress>({
    name: "",
    street: "",
    houseNumber: "",
    city: "",
    postalCode: "",
    phone: "",
  });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IntlReturnLabel | null>(null);
  const [imgError, setImgError] = useState(false);

  const updateField = (field: keyof IntlReturnAddress, value: string) =>
    setAddress((prev) => ({ ...prev, [field]: value }));

  const isFormValid =
    address.name.trim().length > 0 &&
    address.street.trim().length > 0 &&
    address.houseNumber.trim().length > 0 &&
    address.city.trim().length > 0 &&
    address.postalCode.trim().length > 0 &&
    address.phone.trim().length > 0;

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    try {
      const label = await createReturnLabel({
        cid,
        email,
        country,
        address: {
          name: address.name.trim(),
          street: address.street.trim(),
          houseNumber: address.houseNumber.trim(),
          city: address.city.trim(),
          postalCode: address.postalCode.trim(),
          phone: address.phone.trim(),
        },
      });
      setResult(label);
      // v1: tracking is NOT persisted to the order — this event is informational only.
      trackEvent("Label Generated", email, {
        cid,
        country,
        carrier: label.carrier,
        paperless: label.paperless,
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? `Couldn't create your return label: ${err.message}`
          : "Something went wrong. Please try again."
      );
    } finally {
      setGenerating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isFormValid && !generating) handleGenerate();
  };

  /* ── Unsupported country: not available yet ── */
  if (!isSupported) {
    return (
      <div style={container}>
        <BackButton onClick={onBack} />
        <h1 style={headline}>Not available{"\n"}here yet.</h1>
        <p style={bodyText}>
          We can't create a prepaid return label for your country just yet.
          Reach out and we'll sort out your developing by hand.
        </p>
        <a href={`mailto:${CONTACT_EMAIL}?subject=International%20developing%20(camera%20${cid})`} style={contactLink}>
          {CONTACT_EMAIL}
        </a>
      </div>
    );
  }

  /* ── Post-generation: show QR / label ── */
  if (result) {
    const asset = result.qrCodeUrl ?? result.labelUrl;
    return (
      <div style={container}>
        <BackButton onClick={() => setResult(null)} />
        <h1 style={headline}>
          {result.paperless ? "Your return QR." : "Your return label."}
        </h1>

        {asset && !imgError && (
          <div style={result.paperless ? qrWrap : labelWrap}>
            <img
              src={asset}
              alt={result.paperless ? "Return QR code" : "Return label"}
              style={result.paperless ? qrImg : labelImg}
              onError={() => setImgError(true)}
            />
          </div>
        )}

        <p style={bodyText}>
          {result.paperless
            ? `Show this QR at any ${result.carrier} drop-off point — no printing needed.`
            : `Print this ${result.carrier} label and attach it to your mailer.`}
        </p>

        {asset && (
          <a href={asset} target="_blank" rel="noopener noreferrer" style={openLabelBtn}>
            {result.paperless ? "Open QR code" : "Open / print label"}
          </a>
        )}

        <p style={emailNotice}>💡 A copy will be sent to your email.</p>
        <Button onClick={onNext}>Continue</Button>
      </div>
    );
  }

  /* ── Country + address form ── */
  return (
    <div style={container}>
      <BackButton onClick={onBack} />
      <h1 style={headline}>Where are you{"\n"}sending from?</h1>

      {generating ? (
        <div style={{ ...spinnerWrap, minHeight: 200 }}>
          <div style={spinner} />
          <span style={spinnerText}>Creating your return label...</span>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={formWrap}>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{ ...formInput, color: "var(--color-text)" }}
            aria-label="Country"
          >
            {SUPPORTED_COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.label}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Full name"
            autoComplete="name"
            value={address.name}
            onChange={(e) => updateField("name", e.target.value)}
            style={formInput}
          />
          <div style={formRow}>
            <input
              type="text"
              placeholder="Street"
              autoComplete="address-line1"
              value={address.street}
              onChange={(e) => updateField("street", e.target.value)}
              style={{ ...formInput, flex: 1 }}
            />
            <input
              type="text"
              placeholder="No."
              value={address.houseNumber}
              onChange={(e) => updateField("houseNumber", e.target.value)}
              style={{ ...formInput, width: 72 }}
            />
          </div>
          <div style={formRow}>
            <input
              type="text"
              placeholder="City"
              autoComplete="address-level2"
              value={address.city}
              onChange={(e) => updateField("city", e.target.value)}
              style={{ ...formInput, flex: 1 }}
            />
            <input
              type="text"
              placeholder="Postal code"
              autoComplete="postal-code"
              value={address.postalCode}
              onChange={(e) => updateField("postalCode", e.target.value)}
              style={{ ...formInput, width: 120 }}
            />
          </div>
          <input
            type="tel"
            inputMode="tel"
            placeholder="Mobile phone"
            autoComplete="tel"
            value={address.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            style={formInput}
          />

          {error && <p style={errorMsg}>{error}</p>}

          <div style={{ marginTop: 14 }}>
            <Button type="submit" disabled={!isFormValid}>
              Create return label
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

/* ── Styles (mirrors UploadStep) ── */

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

const errorMsg: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 14,
  color: "var(--color-error)",
  textAlign: "center",
  marginTop: 8,
};

const spinnerWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
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

const qrWrap: CSSProperties = {
  alignSelf: "center",
  width: 220,
  height: 220,
  borderRadius: "var(--radius-card)",
  overflow: "hidden",
  marginBottom: 18,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#fff",
};

const qrImg: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "contain",
};

const labelWrap: CSSProperties = {
  alignSelf: "center",
  width: 200,
  marginBottom: 18,
};

const labelImg: CSSProperties = {
  width: "100%",
  height: "auto",
  display: "block",
};

const openLabelBtn: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 20,
  color: "var(--color-text)",
  backgroundColor: "var(--color-selected)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-button)",
  padding: "10px 32px",
  cursor: "pointer",
  alignSelf: "center",
  textDecoration: "none",
  WebkitTapHighlightColor: "transparent",
};

const emailNotice: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 16,
  color: "var(--color-text-muted)",
  textAlign: "center",
  marginTop: 14,
  marginBottom: 24,
};
