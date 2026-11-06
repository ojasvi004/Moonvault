// JSON-RPC proxy to the Arkiv testnet so the access key stays server-side.
// Only read methods and pre-signed raw transactions are forwarded.
import { arkivRpcUrl } from "@/lib/server/env";
import { clientIp, json, limited, rateLimit } from "@/lib/server/rateLimit";

const ALLOWED = new Set([
  "eth_chainId",
  "eth_blockNumber",
  "eth_getBalance",
  "eth_getTransactionCount",
  "eth_estimateGas",
  "eth_gasPrice",
  "eth_maxPriorityFeePerGas",
  "eth_feeHistory",
  "eth_getBlockByNumber",
  "eth_getBlockByHash",
  "eth_getTransactionByHash",
  "eth_getTransactionReceipt",
  "eth_sendRawTransaction",
  "eth_call",
  "eth_fillTransaction",
  "eth_syncing",
  "eth_getCode",
  "eth_getStorageAt",
  "eth_getLogs",
  "eth_accounts",
  "eth_requestAccounts",
  "eth_protocolVersion",
  "eth_getBlockTransactionCountByHash",
  "eth_getBlockTransactionCountByNumber",
  "net_version",
  "net_listening",
  "net_peerCount",
  "web3_clientVersion",
  "web3_sha3",
]);

type RpcCall = { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

function allowed(c: RpcCall) {
  return typeof c.method === "string" && (ALLOWED.has(c.method) || c.method.startsWith("arkiv_"));
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
    },
  });
}

export async function POST(req: Request) {
  const rl = rateLimit(`rpc:${clientIp(req)}`, 600, 60_000);
  if (!rl.ok) return limited(rl.retryAfter);
  const raw = await req.text();
  if (raw.length > 400_000) return json({ error: "Request too large" }, 413);
  let body: RpcCall | RpcCall[];
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }
  const calls = Array.isArray(body) ? body : [body];
  if (calls.length > 20) return json({ error: "Batch too large" }, 413);
  const bad = calls.find((c) => !allowed(c));
  if (bad) return json({ jsonrpc: "2.0", id: bad.id ?? null, error: { code: -32601, message: "Method not allowed" } });

  try {
    const upstream = await fetch(arkivRpcUrl(), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: raw,
      signal: AbortSignal.timeout(25_000),
    });

    const text = await upstream.text();

    // If upstream returns 429 (e.g. ANON_COST_LIMITED), translate to JSON-RPC 2.0 error
    // so Viem handles it cleanly as an RPC error instead of a fatal HTTP transport crash.
    if (upstream.status === 429) {
      let parsed: unknown = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        /* ignore */
      }
      const firstId = Array.isArray(body) ? (body[0]?.id ?? null) : (body?.id ?? null);
      const msg = typeof parsed === "object" && parsed && "message" in parsed
        ? String((parsed as { message: unknown }).message)
        : "Arkiv query rate limit reached";
      return json({
        jsonrpc: "2.0",
        id: firstId,
        error: { code: -32005, message: msg, data: parsed },
      });
    }

    return new Response(text, {
      status: upstream.status,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "access-control-allow-origin": "*",
      },
    });
  } catch {
    // Never echo the upstream URL: it contains the access key.
    return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "Upstream unavailable" } }, 502);
  }
}

