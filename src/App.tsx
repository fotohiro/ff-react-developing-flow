import { useEffect, useMemo, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { getParams } from "./lib/params";
import { trackEvent } from "./lib/api";
import { usePricing, type Market } from "./lib/pricing";
import ProgressBar from "./components/ProgressBar";
import FadeIn from "./components/FadeIn";
import EmailStep from "./components/EmailStep";
import FormatStep from "./components/FormatStep";
import ReturnLabelStep from "./components/ReturnLabelStep";
import IntlReturnStep from "./components/IntlReturnStep";
import ConfirmStep from "./components/ConfirmStep";
import CameraIdStep from "./components/CameraIdStep";
import MyReturnStep from "./components/MyReturnStep";
import type { FormatType } from "./components/FormatStep";

type StepName = "email" | "format" | "returnLabel" | "intlReturn" | "myReturn" | "confirm";

export default function App() {
  const [cid, setCid] = useState(() => getParams().cid);

  if (!cid) {
    const handleCid = (next: string) => {
      const url = new URL(window.location.href);
      url.searchParams.set("cid", next);
      window.history.replaceState(null, "", url);
      setCid(next);
    };
    return (
      <div style={shell}>
        <div style={logoWrap}>
          <img src="/ff-logotype.svg" alt="FOTOFOTO" style={logoImg} />
        </div>
        <div style={content}>
          <CameraIdStep onSubmit={handleCid} />
        </div>
        <SpeedInsights />
        <Analytics />
      </div>
    );
  }

  return <DevelopingFlow cid={cid} />;
}

function DevelopingFlow({ cid }: { cid: string }) {
  const { wbid, prepaid, atLab, lt, discount, discountPct, email: emailParam, fmt } = useMemo(() => getParams(), []);
  const { prices, formatPrice, country, market, loading: pricingLoading, setMarket } = usePricing();
  const hasToken = !!lt;
  const isWeddingBox = !!wbid;
  const isPrepaid = prepaid;
  // Set when the customer taps "Returning in the US?": they'll post it back with the US label.
  const [returnInUS, setReturnInUS] = useState(false);
  // Malaysia-store sessions return to the Malaysian lab. Other non-US visitors use the
  // SendCloud international return step instead of the US photo/EasyPost upload step;
  // US-store visitors in Malaysia are posting it back in the US (they can switch to MY).
  const earlyReturnStep: StepName | null =
    market === "my"
      ? "myReturn"
      : country !== "US" && country !== "MY" && !returnInUS
        ? "intlReturn"
        : null;

  const skipEmail = !!emailParam && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailParam);
  const skipFormat = skipEmail && !!fmt;

  /* Step configuration — adapts to fast-track / at-lab / winback / standard flow.
     For international and Malaysia sessions the return step sits right after
     email and before format, and replaces the US-only upload step. */
  const steps: StepName[] = hasToken
    ? ["format", "confirm"]
    : atLab
      ? (skipEmail ? ["format", "confirm"] : ["email", "format", "confirm"])
      : earlyReturnStep
        ? (skipFormat
            ? [earlyReturnStep, "confirm"]
            : skipEmail
              ? [earlyReturnStep, "format", "confirm"]
              : ["email", earlyReturnStep, "format", "confirm"])
        : (skipFormat
            ? ["returnLabel", "confirm"]
            : skipEmail
              ? ["format", "returnLabel", "confirm"]
              : ["email", "format", "returnLabel", "confirm"]);

  /* Wizard state */
  const [stepIdx, setStepIdx] = useState(0);
  const [email, setEmail] = useState(emailParam ?? "");
  const [format, setFormat] = useState<FormatType | null>(isWeddingBox || isPrepaid ? "scans" : fmt ?? null);
  const [labelImg, setLabelImg] = useState<string | null>(null);
  const [labelSource, setLabelSource] = useState<"camera" | "replacement" | null>(null);
  const [labelTracking, setLabelTracking] = useState<string | null>(null);
  const [printsQty, setPrintsQty] = useState(0);
  const [extraPrintsQty, setExtraPrintsQty] = useState(0);

  useEffect(() => {
    if (skipEmail && emailParam) {
      trackEvent("Started Developing", emailParam, { cid, email: emailParam, source: "winback" });
    }
  }, []);

  const currentStep = steps[stepIdx];

  /* Store switch: Malaysia sessions can fall back to the US; US-store visitors in Malaysia can switch over. */
  const switchTarget: Market | null = pricingLoading
    ? null
    : market === "my"
      ? "us"
      : country === "MY"
        ? "my"
        : null;

  const switchMarket = (next: Market) => {
    const url = new URL(window.location.href);
    url.searchParams.set("market", next);
    window.history.replaceState(null, "", url);
    setReturnInUS(next === "us");
    setMarket(next);
    setStepIdx(0);
  };

  const goNext = () => {
    if (stepIdx < steps.length - 1) setStepIdx(stepIdx + 1);
  };

  const goBack = () => {
    if (stepIdx > 0) setStepIdx(stepIdx - 1);
  };

  /* Step-specific "next" handlers with Klaviyo tracking */
  const handleEmailNext = () => {
    trackEvent("Started Developing", email, { cid, email });
    goNext();
  };

  const handleFormatChange = (f: FormatType) => {
    setFormat(f);
    if (f !== "prints") setExtraPrintsQty(0);
  };

  const handleFormatNext = () => {
    if (!format) return;
    const price = isPrepaid
      ? (printsQty > 0 ? formatPrice(printsQty * prices.prepaidPrints) : "Free")
      : isWeddingBox
        ? formatPrice(prices.wbGallery + printsQty * prices.wbPrints)
        : format === "prints" && extraPrintsQty > 0
          ? formatPrice(prices.prints + extraPrintsQty * prices.extraPrints)
          : formatPrice(prices[format]);
    trackEvent("Selected Format", email, {
      cid, email, format, price,
      ...(isWeddingBox ? { weddingBoxId: wbid, printsQty } : {}),
      ...(isPrepaid ? { prepaid: true, printsQty } : {}),
      ...(extraPrintsQty > 0 ? { extraPrintsQty } : {}),
    });
    goNext();
  };

  const handleUploadNext = () => {
    trackEvent("Uploaded Label", email, { cid, email, has_label: !!labelImg });
    goNext();
  };

  const handleIntlReturnNext = () => {
    goNext();
  };

  const handleCapture = (dataUrl: string) => {
    setLabelImg(dataUrl || null);
    if (!dataUrl) setLabelSource(null);
  };

  /* Render current step */
  const renderStep = () => {
    switch (currentStep) {
      case "email":
        return (
          <EmailStep
            cid={cid}
            email={email}
            onChange={setEmail}
            onNext={handleEmailNext}
          />
        );
      case "format":
        return (
          <FormatStep
            format={format}
            discountPct={discountPct}
            isWeddingBox={isWeddingBox}
            isPrepaid={isPrepaid}
            printsQty={printsQty}
            onPrintsQtyChange={setPrintsQty}
            extraPrintsQty={extraPrintsQty}
            onExtraPrintsQtyChange={setExtraPrintsQty}
            onChange={handleFormatChange}
            onNext={handleFormatNext}
            onBack={goBack}
          />
        );
      case "returnLabel":
        return (
          <ReturnLabelStep
            cid={cid}
            email={email}
            labelImg={labelImg}
            onCapture={handleCapture}
            onLabelSourceChange={setLabelSource}
            onTrackingChange={setLabelTracking}
            onNext={handleUploadNext}
            onBack={goBack}
          />
        );
      case "intlReturn":
        return (
          <IntlReturnStep
            cid={cid}
            email={email}
            onNext={handleIntlReturnNext}
            onBack={goBack}
          />
        );
      case "myReturn":
        return <MyReturnStep cid={cid} onBack={goBack} />;
      case "confirm":
        return (
          <ConfirmStep
            cid={cid}
            email={email}
            format={format!}
            labelImg={labelImg}
            labelToken={lt}
            labelSource={labelSource}
            labelTracking={labelTracking}
            discountCode={discount}
            discountPct={discountPct}
            weddingBoxId={wbid}
            isPrepaid={isPrepaid}
            printsQty={printsQty}
            extraPrintsQty={extraPrintsQty}
            onBack={goBack}
          />
        );
    }
  };

  return (
    <div style={shell}>
      {/* FOTOFOTO logotype */}
      <div style={logoWrap}>
        <img
          src="/ff-logotype.svg"
          alt="FOTOFOTO"
          style={logoImg}
        />
      </div>

      {/* Progress bar */}
      <ProgressBar total={steps.length} current={stepIdx} />

      {/* Step content with fade animation */}
      <FadeIn stepKey={currentStep}>
        <div style={content}>{renderStep()}</div>
      </FadeIn>

      {switchTarget && currentStep !== "confirm" && (
        <button type="button" style={marketSwitch} onClick={() => switchMarket(switchTarget)}>
          {switchTarget === "us" ? "Returning in the US?" : "Returning in Malaysia?"}
        </button>
      )}

      <SpeedInsights />
      <Analytics />
    </div>
  );
}

const shell: React.CSSProperties = {
  minHeight: "100dvh",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  overflow: "hidden",
};

const logoWrap: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  paddingTop: 21,
};

const logoImg: React.CSSProperties = {
  height: 19,
  width: "auto",
  opacity: 0.9,
};

const content: React.CSSProperties = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  paddingTop: 10,
};

const marketSwitch: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: 15,
  color: "var(--color-text-secondary)",
  textDecoration: "underline",
  background: "none",
  border: "none",
  padding: "24px var(--page-padding) 32px",
  cursor: "pointer",
  alignSelf: "center",
  WebkitTapHighlightColor: "transparent",
};
