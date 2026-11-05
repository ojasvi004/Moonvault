// Testnet funding relay. thirdweb gas sponsorship cannot be used for Arkiv's
// native entity operations, so this sends a tiny amount of free faucet tokens
// (tGLM on the Arkiv testnet) from a server-held relay key to a user's address.
// Rate-limited per IP and per address; only funds when the balance is low.
import { createPublicClient, createWalletClient, formatEther, http, isAddress, parseEther, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arkivRpcUrl, serverEnv } from "@/lib/server/env";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";

export const maxDuration = 60;

const chain = defineChain({
  id: 7794095,
  name: "Rabdi",
  nativeCurrency: { name: "Golem", symbol: "tGLM", decimals: 18 },
  rpcUrls: { default: { http: [arkivRpcUrl()] } },
  testnet: true,
});

export async function POST(req: Request) {
  const ip = clientIp(req);
  const rl = rateLimit(`fund-ip:${ip}`, 10, 60 * 60_000);
  if (!rl.ok) return limited(rl.retryAfter);

  let address = "";
  try {
    address = String(((await req.json()) as { address?: string }).address ?? "");
  } catch {
    /* fallthrough */
  }
  if (!isAddress(address)) return json({ error: "Invalid account" }, 400);

  const transport = http(arkivRpcUrl(), { timeout: 20_000 });
  const pub = createPublicClient({ chain, transport });
  try {
    const balance = await pub.getBalance({ address });
    if (balance >= parseEther(serverEnv.fundMinBalanceEth)) return json({ funded: false, balance: formatEther(balance) });

    if (!serverEnv.relayKey) return json({ error: "Syncing is not configured on this server (missing relay key)." }, 503);
    const perAddr = rateLimit(`fund-addr:${address.toLowerCase()}`, 3, 24 * 60 * 60_000);
    if (!perAddr.ok) return limited(perAddr.retryAfter);

    const relay = privateKeyToAccount(serverEnv.relayKey as `0x${string}`);
    const wallet = createWalletClient({ chain, transport, account: relay });
    const hash = await wallet.sendTransaction({ to: address, value: parseEther(serverEnv.fundAmountEth) });
    const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 45_000 });
    if (receipt.status !== "success") return json({ error: "Funding transaction failed" }, 502);
    return json({ funded: true, txHash: hash });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (/insufficient funds|exceeds the balance/i.test(msg)) return json({ error: "The sync relay is out of test funds. Please tell the team." }, 503);
    return json({ error: "Could not prepare your account for syncing. Please retry." }, 502);
  }
}
