import assert from "node:assert/strict";
import test from "node:test";
import { MARKET_PROFILES, supportChatUrl } from "../src/lib/markets.ts";

test("Malaysia sessions use the DHL return step and have a WhatsApp support chat", () => {
  assert.equal(MARKET_PROFILES.my.returnStep, "myReturn");
  assert.ok(MARKET_PROFILES.my.support?.link.startsWith("https://wa.me/"));
  assert.equal(MARKET_PROFILES.us.returnStep, null);
  assert.equal(MARKET_PROFILES.us.support, null);
});

test("the support chat opens the short link until a phone number is set", () => {
  const support = { name: "Lab", link: "https://wa.me/message/ABC" };
  assert.equal(supportChatUrl(support, "61001"), "https://wa.me/message/ABC");
});

test("with a phone number the chat opens with the camera or box typed", () => {
  const support = { name: "Lab", link: "https://wa.me/message/ABC", phone: "60123456789" };
  assert.equal(
    supportChatUrl(support, "61001"),
    `https://wa.me/60123456789?text=${encodeURIComponent("Hi! I need help developing camera #61001.")}`
  );
  assert.match(decodeURIComponent(supportChatUrl(support, "61001", "WB123")), /Wedding Box WB123 \(camera #61001\)/);
});
