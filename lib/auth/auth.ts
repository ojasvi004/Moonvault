// Account sign-in. Real mode: thirdweb in-app wallet with email-code login
// (lazy-loaded). Mock mode: a deterministic local test account per email.
// The account key only identifies the user and signs record writes. It is
// never used to encrypt health data (the vault passphrase does that).
import type { Account as ViemAccount } from "viem";
import { ARKIV_CHAIN_ID, THIRDWEB_CLIENT_ID, isMockAuth } from "@/lib/config";

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "signedIn"; address: string; email?: string; mock: boolean };

type Listener = () => void;
let state: AuthState = { status: "loading" };
const listeners = new Set<Listener>();
function set(s: AuthState) {
  state = s;
  listeners.forEach((l) => l());
}
export function subscribeAuth(l: Listener) {
  listeners.add(l);
  return () => listeners.delete(l);
}
export function getAuth(): AuthState {
  return state;
}

// ------------------------------------------------------------- thirdweb

type TW = {
  client: import("thirdweb").ThirdwebClient;
  chain: import("thirdweb").Chain;
  wallet: import("thirdweb/wallets").Wallet<"inApp">;
  preAuthenticate: typeof import("thirdweb/wallets/in-app").preAuthenticate;
  getUserEmail: typeof import("thirdweb/wallets/in-app").getUserEmail;
};
let tw: Promise<TW> | null = null;
let twAccount: import("thirdweb/wallets").Account | null = null;

function loadThirdweb(): Promise<TW> {
  if (!tw) {
    tw = (async () => {
      // Import only the in-app wallet entry point; "thirdweb/wallets" pulls in every wallet type.
      const [{ createThirdwebClient, defineChain }, inApp] = await Promise.all([import("thirdweb"), import("thirdweb/wallets/in-app")]);
      const { inAppWallet } = inApp;
      const client = createThirdwebClient({ clientId: THIRDWEB_CLIENT_ID });
      const chain = defineChain({
        id: ARKIV_CHAIN_ID,
        name: "Rabdi",
        rpc: `${window.location.origin}/api/arkiv-rpc`,
        nativeCurrency: { name: "Golem", symbol: "tGLM", decimals: 18 },
        testnet: true,
      });
      // Plain EOA mode on purpose: Arkiv's native entity operations require
      // the account itself to send the transaction (see DECISIONS.md).
      const wallet = inAppWallet({ auth: { options: ["email"] } });
      return { client, chain, wallet, preAuthenticate: inApp.preAuthenticate, getUserEmail: inApp.getUserEmail };
    })();
  }
  return tw;
}

// ------------------------------------------------------------- mock

const MOCK_KEY = "mv.mockSession";
export const MOCK_CODE = "123456";

async function mockAccountFor(email: string): Promise<ViemAccount> {
  const { privateKeyToAccount } = await import("viem/accounts");
  // Deterministic per email so "restore on a new device" works in mock mode.
  // Mock only; never used with real services.
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`moonvault-mock-account:${email.toLowerCase()}`)));
  const hex = ("0x" + Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")) as `0x${string}`;
  return privateKeyToAccount(hex);
}
let mockAccount: ViemAccount | null = null;

// ------------------------------------------------------------- public API

let restoring: Promise<void> | null = null;

export function restoreSession(): Promise<void> {
  if (state.status !== "loading") return Promise.resolve();
  if (!restoring) {
    restoring = (async () => {
      try {
        if (isMockAuth()) {
          const email = localStorage.getItem(MOCK_KEY);
          if (!email) return set({ status: "signedOut" });
          mockAccount = await mockAccountFor(email);
          return set({ status: "signedIn", address: mockAccount.address, email, mock: true });
        }
        const t = await loadThirdweb();
        twAccount = await t.wallet.autoConnect({ client: t.client, chain: t.chain });
        const email = await t.getUserEmail({ client: t.client }).catch(() => undefined);
        set({ status: "signedIn", address: twAccount.address, email, mock: false });
      } catch {
        set({ status: "signedOut" });
      }
    })();
  }
  return restoring;
}

export async function sendCode(email: string): Promise<void> {
  if (isMockAuth()) return;
  const t = await loadThirdweb();
  await t.preAuthenticate({ client: t.client, strategy: "email", email });
}

export async function verifyCode(email: string, code: string): Promise<void> {
  if (isMockAuth()) {
    if (code.trim() !== MOCK_CODE) throw new Error("That code is not right.");
    localStorage.setItem(MOCK_KEY, email.toLowerCase());
    mockAccount = await mockAccountFor(email);
    set({ status: "signedIn", address: mockAccount.address, email: email.toLowerCase(), mock: true });
    return;
  }
  const t = await loadThirdweb();
  twAccount = await t.wallet.connect({ client: t.client, chain: t.chain, strategy: "email", email, verificationCode: code.trim() });
  set({ status: "signedIn", address: twAccount.address, email: email.toLowerCase(), mock: false });
}

export async function signOut(): Promise<void> {
  if (isMockAuth()) {
    localStorage.removeItem(MOCK_KEY);
    mockAccount = null;
  } else {
    const t = await loadThirdweb();
    await t.wallet.disconnect();
    twAccount = null;
  }
  restoring = null;
  set({ status: "signedOut" });
}

/** A viem Account that signs with the signed-in account (for record writes). */
export async function getSigner(): Promise<ViemAccount> {
  if (isMockAuth()) {
    if (!mockAccount) throw new Error("Please sign in again.");
    return mockAccount;
  }
  if (!twAccount) throw new Error("Please sign in again.");
  const acct = twAccount;
  if (!acct.signTransaction) throw new Error("This account cannot sign record updates.");
  const { toAccount } = await import("viem/accounts");
  return toAccount({
    address: acct.address as `0x${string}`,
    signMessage: ({ message }) => acct.signMessage({ message }),
    signTransaction: (tx) => acct.signTransaction!(tx as Parameters<NonNullable<typeof acct.signTransaction>>[0]),
    signTypedData: (td) => acct.signTypedData(td as Parameters<typeof acct.signTypedData>[0]),
  });
}
