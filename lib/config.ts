// Public (browser-safe) configuration. Only NEXT_PUBLIC_* values may appear here.

export const MOCK_SERVICES = process.env.NEXT_PUBLIC_MOCK_SERVICES === "true";

/** thirdweb client ID is publishable by design (it is not a secret key). */
export const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID ?? "";

export const ARKIV_CHAIN_ID = 7794095;
export const ARKIV_PUBLIC_RPC = "https://rpc.rabdi.db-chain.testnet.arkiv.network";

/** Auto-lock after this many ms without user interaction. */
export const AUTO_LOCK_MS = Number(process.env.NEXT_PUBLIC_AUTO_LOCK_MINUTES ?? "5") * 60_000;

/** Auto-backup after this many unsynced entries. */
export const AUTO_BACKUP_THRESHOLD = 1;

// 0G providers can take longer than 30 seconds to cold-start. Keep this below
// the server route's hard limit while allowing normal provider latency.
export const AI_TIMEOUT_MS = 55_000;

export const APP_TAG = "mv"; // generic prefix used in public record schema names

export function isMockAuth(): boolean {
  return MOCK_SERVICES || !THIRDWEB_CLIENT_ID;
}
