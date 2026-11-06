// Make sure the account can pay for its record writes on the test network.
// thirdweb gas sponsorship cannot be used with Arkiv's native operations,
// so our /api/fund relay tops up small amounts of free testnet tokens.
import { MOCK_AUTH, MOCK_RECORDS } from "@/lib/config";

let inflight: Promise<void> | null = null;

export function ensureGas(address: string): Promise<void> {
  if (MOCK_RECORDS || MOCK_AUTH) return Promise.resolve();
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch("/api/fund", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; funded?: boolean; txHash?: string };
        if (!res.ok) {
          console.warn("[Gas Relay] Top-up notice:", body.error ?? res.statusText);
        }
      } catch (err) {
        console.warn("[Gas Relay] Network notice:", err);
      }
    })().finally(() => {
      inflight = null;
    });
  }
  return inflight;
}

