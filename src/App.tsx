import { useMemo, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { getParams } from "./lib/params";
import { trackEvent } from "./lib/api";
import ProgressBar from "./components/ProgressBar";
import FadeIn from "./components/FadeIn";
import EmailStep from "./components/EmailStep";
import FormatStep from "./components/FormatStep";
import UploadStep from "./components/UploadStep";
import ConfirmStep from "./components/ConfirmStep";
import type { FormatType } from "./components/FormatStep";

type StepName = "email" | "format" | "upload" | "confirm";

export default function App() {
  const { cid, lt, discount, discountPct, email: emailParam } = useMemo(getParams, []);
  const hasToken = !!lt;

  /* Step configuration — adapts to fast-track vs. standard flow */
  const steps: StepName[] = hasToken
    ? ["format", "confirm"]
    : ["email", "format", "upload", "confirm"];

  /* Wizard state */
  const [stepIdx, setStepIdx] = useState(0);
  const [email, setEmail] = useState(emailParam ?? "");
  const [format, setFormat] = useState<FormatType | null>(null);
  const [labelImg, setLabelImg] = useState<string | null>(null);
  const [labelSource, setLabelSource] = useState<"camera" | "replacement" | null>(null);

  const currentStep = steps[stepIdx];

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

  const handleFormatNext = () => {
    if (!format) return;
    const price = format === "scans" ? "$9.99" : "$16.99";
    trackEvent("Selected Format", email, { cid, email, format, price });
    goNext();
  };

  const handleUploadNext = () => {
    trackEvent("Uploaded Label", email, { cid, email, has_label: !!labelImg });
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
            onChange={setFormat}
            onNext={handleFormatNext}
            onBack={goBack}
          />
        );
      case "upload":
        return (
          <UploadStep
            cid={cid}
            email={email}
            labelImg={labelImg}
            onCapture={handleCapture}
            onLabelSourceChange={setLabelSource}
            onNext={handleUploadNext}
            onBack={goBack}
          />
        );
      case "confirm":
        return (
          <ConfirmStep
            cid={cid}
            email={email}
            format={format!}
            labelImg={labelImg}
            labelToken={lt}
            labelSource={labelSource}
            discountCode={discount}
            discountPct={discountPct}
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
