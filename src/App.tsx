import { useEffect, useMemo, useState } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Analytics } from "@vercel/analytics/react";
import { cameraRouterRedirectUrl, getParams } from "./lib/params";
import { trackEvent } from "./lib/api";
import { usePricing, type Market } from "./lib/pricing";
import { boxTotals, chosenBoxes, fetchBoxContext, labelNeeds, linkBox, planBoxOffer, showsBoxStep, type BoxChoice, type BoxContext, type BoxOffer } from "./lib/boxes";
import { buildSteps, type StepName } from "./lib/steps";
import ProgressBar from "./components/ProgressBar";
import FadeIn from "./components/FadeIn";
import EmailStep from "./components/EmailStep";
import FormatStep from "./components/FormatStep";
import ReturnLabelStep from "./components/ReturnLabelStep";
import IntlReturnStep from "./components/IntlReturnStep";
import ConfirmStep from "./components/ConfirmStep";
import BoxStep from "./components/BoxStep";
import PaidBoxStep from "./components/PaidBoxStep";
import CameraIdStep from "./components/CameraIdStep";
import MyReturnStep from "./components/MyReturnStep";
import type { FormatType } from "./components/FormatStep";

export default function App() {
  const [cid, setCid] = useState(() => getParams().cid);
  const routerRedirect = useMemo(
    () =>
      cid
        ? cameraRouterRedirectUrl(window.location.search, window.location.hostname)
        : null,
    [cid]
  );

  useEffect(() => {
    if (routerRedirect) {
      window.location.replace(routerRedirect);
    }
  }, [routerRedirect]);

  if (routerRedirect) {
    return <div style={shell} />;
  }

  if (!cid) {
    const handleCid = (next: string) => {
      const target = cameraRouterRedirectUrl(
        window.location.search,
        window.location.hostname,
        next
      );
      if (target) {
        window.location.replace(target);
        return;
      }
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
  const asksEmail = !hasToken && !skipEmail;

  /* Wedding Boxes that shipped with this one. The offer is worked out once the email is known:
     on load when the link carries it, otherwise when the email step is submitted. Until then,
     and whenever the lookup fails, the checkout is for the one box the link names. */
  const [offer, setOffer] = useState<BoxOffer>({ kind: "link" });
  const [boxChoice, setBoxChoice] = useState<BoxChoice | null>(null);
  const [offerLoading, setOfferLoading] = useState(!!wbid && !asksEmail);

  const applyContext = (context: BoxContext | null) => {
    if (!wbid) return;
    const next = planBoxOffer(context, wbid, { prepaid, atLab });
    setOffer(next);
    setBoxChoice(next.kind === "boxes" && next.preselectAll ? "all" : null);
    setOfferLoading(false);
  };

  // A stale link's box no longer applies: the camera checks out on its own.
  const weddingBoxId = offer.kind === "standard" ? null : wbid;
  const isWeddingBox = !!weddingBoxId;
  const boxes = !weddingBoxId
    ? []
    : offer.kind === "boxes"
      ? chosenBoxes(offer, boxChoice)
      : [linkBox(weddingBoxId, cid, { prepaid, atLab })];
  const isPrepaid = isWeddingBox ? boxes.every((b) => b.state === "prepaid") : prepaid && offer.kind !== "standard";
  // The label step and the label sent to the cart both follow the chosen boxes (see labelNeeds).
  const { atHome: boxesAtHome, skipStep: skipLabel, send: sendLabel } = labelNeeds(boxes, atLab);

  /* Step configuration — adapts to fast-track / at-lab / winback / standard flow (see buildSteps). */
  const steps: StepName[] = buildSteps({
    hasToken,
    skipLabel,
    skipEmail,
    skipFormat,
    earlyReturnStep,
    boxStep: showsBoxStep(offer),
  });

  /* Wizard state */
  const [stepIdx, setStepIdx] = useState(0);
  const [email, setEmail] = useState(emailParam ?? "");
  const [format, setFormat] = useState<FormatType | null>(wbid || prepaid ? "scans" : fmt ?? null);
  const [labelImg, setLabelImg] = useState<string | null>(null);
  const [labelSource, setLabelSource] = useState<"camera" | "replacement" | null>(null);
  const [labelTracking, setLabelTracking] = useState<string | null>(null);
  const [printsQty, setPrintsQty] = useState(0);
  const [extraPrintsQty, setExtraPrintsQty] = useState(0);

  useEffect(() => {
    if (skipEmail && emailParam) {
      trackEvent("Started Developing", emailParam, {
        cid,
        email: emailParam,
        source: "winback",
        ...(wbid ? { weddingBoxId: wbid } : {}),
        ...(isPrepaid ? { prepaid: true } : {}),
      });
    }
    if (wbid && !asksEmail) void fetchBoxContext(cid, wbid, emailParam ?? "").then(applyContext);
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
  const handleEmailNext = async () => {
    trackEvent("Started Developing", email, {
      cid,
      email,
      ...(wbid ? { weddingBoxId: wbid } : {}),
      ...(isPrepaid ? { prepaid: true } : {}),
    });
    if (wbid) {
      setOfferLoading(true);
      applyContext(await fetchBoxContext(cid, wbid, email));
    }
    setStepIdx(1);
  };

  const handleBoxesNext = () => {
    trackEvent("Selected Boxes", email, { cid, email, weddingBoxId: wbid, weddingBoxIds: boxes.map((b) => b.id) });
    goNext();
  };

  const handleFormatChange = (f: FormatType) => {
    setFormat(f);
    if (f !== "prints") setExtraPrintsQty(0);
  };

  const handleFormatNext = () => {
    if (!format) return;
    const boxTotal = boxTotals(boxes, printsQty, prices).total;
    const price = isWeddingBox
      ? (boxTotal > 0 ? formatPrice(boxTotal) : "Free")
      : isPrepaid
        ? (printsQty > 0 ? formatPrice(printsQty * prices.prepaidPrints) : "Free")
        : format === "prints" && extraPrintsQty > 0
          ? formatPrice(prices.prints + extraPrintsQty * prices.extraPrints)
          : formatPrice(prices[format]);
    trackEvent("Selected Format", email, {
      cid, email, format, price,
      ...(isWeddingBox ? { weddingBoxId: weddingBoxId, weddingBoxIds: boxes.map((b) => b.id), printsQty } : {}),
      ...(isPrepaid ? { prepaid: true, printsQty } : {}),
      ...(extraPrintsQty > 0 ? { extraPrintsQty } : {}),
    });
    goNext();
  };

  const handleUploadNext = () => {
    trackEvent("Uploaded Label", email, {
      cid,
      email,
      has_label: !!labelImg,
      ...(weddingBoxId ? { weddingBoxId } : {}),
      ...(isPrepaid ? { prepaid: true } : {}),
    });
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
            busy={offerLoading}
          />
        );
      case "boxes":
        if (offer.kind !== "boxes") return null;
        return (
          <BoxStep
            offer={offer}
            choice={boxChoice}
            onChoose={setBoxChoice}
            onNext={handleBoxesNext}
            onBack={stepIdx > 0 ? goBack : undefined}
          />
        );
      case "format":
        return (
          <FormatStep
            format={format}
            discountPct={discountPct}
            isWeddingBox={isWeddingBox}
            boxCount={boxes.length}
            payableBoxCount={boxTotals(boxes, 0, prices).payable}
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
            weddingBoxId={weddingBoxId}
            boxesAtHome={boxesAtHome}
            isPrepaid={isPrepaid}
            labelImg={labelImg}
            labelSource={labelSource}
            labelTracking={labelTracking}
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
            labelImg={sendLabel ? labelImg : null}
            labelToken={lt}
            labelSource={sendLabel ? labelSource : null}
            labelTracking={sendLabel ? labelTracking : null}
            discountCode={discount}
            discountPct={discountPct}
            boxes={boxes}
            isPrepaid={isPrepaid}
            printsQty={printsQty}
            extraPrintsQty={extraPrintsQty}
            onBack={goBack}
          />
        );
    }
  };

  // The link carries the email, so the first step depends on the offer: wait for it.
  if (offerLoading && !asksEmail) {
    return <div style={shell} />;
  }

  if (offer.kind === "paid") {
    return (
      <div style={shell}>
        <div style={logoWrap}>
          <img src="/ff-logotype.svg" alt="FOTOFOTO" style={logoImg} />
        </div>
        <div style={content}>
          <PaidBoxStep />
        </div>
        <SpeedInsights />
        <Analytics />
      </div>
    );
  }

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
