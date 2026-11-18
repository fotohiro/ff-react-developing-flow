import assert from "node:assert/strict";
import test from "node:test";
import { buildSteps } from "../src/lib/steps.ts";

const base = { hasToken: false, skipLabel: false, skipEmail: false, skipFormat: false, earlyReturnStep: null, boxStep: false } as const;

test("without a box step the steps are what they were", () => {
  assert.deepEqual(buildSteps(base), ["email", "format", "returnLabel", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, skipEmail: true }), ["format", "returnLabel", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, skipEmail: true, skipFormat: true }), ["returnLabel", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, skipLabel: true }), ["email", "format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, skipLabel: true, skipEmail: true }), ["format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, hasToken: true }), ["format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, earlyReturnStep: "intlReturn" }), ["email", "intlReturn", "format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, earlyReturnStep: "myReturn", skipEmail: true }), ["myReturn", "format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, earlyReturnStep: "myReturn", skipEmail: true, skipFormat: true }), ["myReturn", "confirm"]);
});

test("the box step comes right after email, or first when the email is already known", () => {
  assert.deepEqual(buildSteps({ ...base, boxStep: true }), ["email", "boxes", "format", "returnLabel", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, boxStep: true, skipLabel: true }), ["email", "boxes", "format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, boxStep: true, skipEmail: true }), ["boxes", "format", "returnLabel", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, boxStep: true, hasToken: true }), ["boxes", "format", "confirm"]);
  assert.deepEqual(buildSteps({ ...base, boxStep: true, earlyReturnStep: "intlReturn" }), ["email", "boxes", "intlReturn", "format", "confirm"]);
});

test("choosing boxes that still need a label only changes steps after the box step", () => {
  const atLab = buildSteps({ ...base, boxStep: true, skipLabel: true });
  const atHome = buildSteps({ ...base, boxStep: true, skipLabel: false });
  assert.deepEqual(atLab.slice(0, 2), atHome.slice(0, 2));
});
