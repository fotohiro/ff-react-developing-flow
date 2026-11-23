import type { Market } from "./pricing";

/** A market's lab support chat on WhatsApp. */
export interface SupportContact {
  /** Name shown on the WhatsApp business account. */
  name: string;
  /** Business short link (wa.me/message/...): opens the chat, can't carry a message. */
  link: string;
  /** International number, digits only. When set, the chat opens with the camera ID typed. */
  phone?: string;
}

/** What a return market changes in the flow. Everything else is shared. */
export interface MarketProfile {
  /** Replaces the US label step (and the international one) for this market's sessions. */
  returnStep: "myReturn" | null;
  support: SupportContact | null;
}

export const MARKET_PROFILES: Record<Market, MarketProfile> = {
  us: { returnStep: null, support: null },
  my: {
    returnStep: "myReturn",
    support: { name: "Nova Experientia", link: "https://wa.me/message/JVRPOF5NMZHGL1" },
  },
};

export function supportChatUrl(support: SupportContact, cid: string, weddingBoxId?: string | null): string {
  if (!support.phone) return support.link;
  const text = weddingBoxId
    ? `Hi! I need help developing Wedding Box ${weddingBoxId} (camera #${cid}).`
    : `Hi! I need help developing camera #${cid}.`;
  return `https://wa.me/${support.phone}?text=${encodeURIComponent(text)}`;
}
