/** Detect in-app browsers (WebViews) that block camera access */
export function isInAppBrowser(): boolean {
  const ua = navigator.userAgent || "";

  // Known in-app browser markers
  if (/FBAN|FBAV|Instagram|Messenger/i.test(ua)) return true;
  if (/GSA\//i.test(ua)) return true;
  if (/Outlook/i.test(ua)) return true;
  if (/Line\//i.test(ua)) return true;
  if (/WeChat|MicroMessenger/i.test(ua)) return true;
  if (/Twitter|X\//i.test(ua)) return true;

  // Generic iOS WebView: real Safari includes "Version/X"; most WebViews omit it
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const hasSafari = /Safari/.test(ua);
  const hasVersion = /Version\//.test(ua);
  if (isIOS && hasSafari && !hasVersion) return true;

  return false;
}
