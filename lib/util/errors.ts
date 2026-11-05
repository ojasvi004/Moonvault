// User-facing error text helpers (shared by UI and background managers).

const TECHNICAL = /\b(wallet|blockchain|hash|arkiv|0g|node|gas|on-chain|decentralized|transaction|rpc|revert|nonce|0x[0-9a-f]{6,})\b/i;

/** User-facing error text. Raw SDK/network messages are replaced so no technical jargon leaks into the UI. */
export function errMsg(e: unknown): string {
  if (!(e instanceof Error)) return "Something went wrong.";
  const m = e.message || "";
  if (/failed to fetch|networkerror|load failed/i.test(m)) return "Network problem. Check your connection and try again.";
  if (/exceeds the balance|insufficient funds/i.test(m)) return "Your account isn't ready to sync yet. Please try again in a minute.";
  if (TECHNICAL.test(m) || m.length > 180) {
    if (typeof console !== "undefined") console.warn("[moonvault]", m);
    return "The cloud service had a problem. Please try again.";
  }
  return m;
}
