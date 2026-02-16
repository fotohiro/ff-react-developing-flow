/** Parse URL search params on mount */
export function getParams() {
  const sp = new URLSearchParams(window.location.search);
  return {
    cid: sp.get("cid") ?? "0000",
    lt: sp.get("lt"),           // label token — null if not present
    discount: sp.get("discount"), // winback discount code
    email: sp.get("email"),       // pre-fill from Klaviyo link
  };
}
