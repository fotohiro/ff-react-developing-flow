export type StepName = "email" | "boxes" | "format" | "returnLabel" | "intlReturn" | "myReturn" | "confirm";

/**
 * The wizard's steps. International and Malaysia sessions put their return step right after
 * email and before format, replacing the US label step. The box step, when shown, comes right
 * after email, so nothing before the customer's position changes once they have chosen.
 */
export function buildSteps(o: {
  hasToken: boolean;
  skipLabel: boolean;
  skipEmail: boolean;
  skipFormat: boolean;
  earlyReturnStep: "intlReturn" | "myReturn" | null;
  boxStep: boolean;
}): StepName[] {
  const steps: StepName[] = o.hasToken
    ? ["format", "confirm"]
    : o.skipLabel
      ? (o.skipEmail ? ["format", "confirm"] : ["email", "format", "confirm"])
      : o.earlyReturnStep
        ? (o.skipFormat
            ? [o.earlyReturnStep, "confirm"]
            : o.skipEmail
              ? [o.earlyReturnStep, "format", "confirm"]
              : ["email", o.earlyReturnStep, "format", "confirm"])
        : (o.skipFormat
            ? ["returnLabel", "confirm"]
            : o.skipEmail
              ? ["format", "returnLabel", "confirm"]
              : ["email", "format", "returnLabel", "confirm"]);
  if (!o.boxStep) return steps;
  const at = steps[0] === "email" ? 1 : 0;
  return [...steps.slice(0, at), "boxes", ...steps.slice(at)];
}
