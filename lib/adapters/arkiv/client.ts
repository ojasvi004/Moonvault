// Arkiv client factory. In the browser every RPC call goes through our own
// /api/arkiv-rpc route so the Arkiv access key stays server-side. Signing
// happens in the browser (the wallet key never leaves thirdweb's enclave);
// the proxy only forwards already-signed raw transactions.
import { createPublicClient, createWalletClient } from "@arkiv-network/sdk";
import { rabdi } from "@arkiv-network/sdk/chains";
import { http, type Account } from "viem";

function transportUrl(): string {
  if (typeof window !== "undefined") return `${window.location.origin}/api/arkiv-rpc`;
  const key = process.env.ARKIV_ACCESS_KEY ?? "";
  return key ? `https://rpc.rabdi.db-chain.testnet.arkiv.network/${encodeURIComponent(key)}` : "https://rpc.rabdi.db-chain.testnet.arkiv.network";
}

// The chain object's own RPC URL is never used because every transport below
// passes an explicit URL; a placeholder key avoids the SDK's public-endpoint warning.
const chain = rabdi({ accessKey: "via-transport" });

let publicClient: ReturnType<typeof createPublicClient> | null = null;

export function arkivPublic() {
  if (!publicClient) {
    publicClient = createPublicClient({ chain, transport: http(transportUrl(), { retryCount: 2, timeout: 20_000 }) });
  }
  return publicClient;
}

export function arkivWallet(account: Account) {
  return createWalletClient({ chain, account, transport: http(transportUrl(), { retryCount: 1, timeout: 60_000 }) });
}

export const ARKIV_BLOCK_MS = 2000;

/** Convert an absolute expiry block to an approximate wall-clock time. */
export async function blockToMs(block: bigint): Promise<number> {
  const head = await arkivPublic().getBlockNumber();
  return Date.now() + Number(block - head) * ARKIV_BLOCK_MS;
}
