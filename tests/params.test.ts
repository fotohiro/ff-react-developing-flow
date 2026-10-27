import assert from "node:assert/strict";
import test from "node:test";
import { cameraRouterRedirectUrl, normalizeCid } from "../src/lib/params.ts";

test("normalizeCid strips cid- prefix and rejects zero/invalid", () => {
  assert.equal(normalizeCid("73010"), "73010");
  assert.equal(normalizeCid("cid-05023"), "05023");
  assert.equal(normalizeCid("0000"), null);
  assert.equal(normalizeCid(""), null);
});

test("cameraRouterRedirectUrl bounces unrouted Klaviyo winback links through ff-camera-router", () => {
  assert.equal(
    cameraRouterRedirectUrl("?cid=73010&email=halkast1%40gmail.com", "lab.fotofoto.io"),
    "https://ff-camera-router.vercel.app/api/route?cid=73010&email=halkast1%40gmail.com"
  );
});

test("cameraRouterRedirectUrl skips redirect when wbid, prepaid=true, or routed=1 is already present", () => {
  assert.equal(
    cameraRouterRedirectUrl("?cid=73010&wbid=WB-20261007-001&email=halkast1%40gmail.com", "lab.fotofoto.io"),
    null
  );
  assert.equal(
    cameraRouterRedirectUrl("?cid=73010&prepaid=true", "lab.fotofoto.io"),
    null
  );
  assert.equal(
    cameraRouterRedirectUrl("?cid=73010&email=halkast1%40gmail.com&routed=1", "lab.fotofoto.io"),
    null
  );
});

test("cameraRouterRedirectUrl routes manually entered cid through ff-camera-router on production host", () => {
  assert.equal(
    cameraRouterRedirectUrl("", "lab.fotofoto.io", "73010"),
    "https://ff-camera-router.vercel.app/api/route?cid=73010"
  );
  assert.equal(
    cameraRouterRedirectUrl("", "localhost", "73010"),
    null
  );
});
