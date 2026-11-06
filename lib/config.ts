// Public (browser-safe) configuration. Only NEXT_PUBLIC_* values may appear here.

export const MOCK_SERVICES = process.env.NEXT_PUBLIC_MOCK_SERVICES === "true";

// Per-service overrides. Each defaults to MOCK_SERVICES, so a demo can keep a
// blocked service (e.g. unfunded Arkiv writes) simulated while 0G stays real.
// Next.js inlines NEXT_PUBLIC_* only for literal property access, hence no helper.
const flag = (v: string | undefined) => (v === "true" ? true : v === "false" ? false : MOCK_SERVICES);
export const MOCK_AI = flag(process.env.NEXT_PUBLIC_MOCK_AI);
export const MOCK_STORAGE = flag(process.env.NEXT_PUBLIC_MOCK_STORAGE);
export const MOCK_RECORDS = flag(process.env.NEXT_PUBLIC_MOCK_RECORDS);
export const MOCK_AUTH = flag(process.env.NEXT_PUBLIC_MOCK_AUTH);

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

/** Human-readable names of the services currently simulated (empty = all real). */
export function simulatedServices(): string[] {
  return [MOCK_AUTH && "sign-in", MOCK_RECORDS && "account records", MOCK_STORAGE && "cloud backup", MOCK_AI && "AI"].filter(Boolean) as string[];
}

export function isMockAuth(): boolean {
  return MOCK_AUTH || !THIRDWEB_CLIENT_ID;
}
