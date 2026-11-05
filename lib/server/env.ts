// Server-only configuration. Never import this from client components.
import "server-only";

export const serverEnv = {
  zgApiKey: process.env.ZG_API_KEY ?? "",
  zgBaseUrl: (process.env.ZG_BASE_URL ?? "https://router-api.0g.ai/v1").replace(/\/$/, ""),
  zgChatModel: process.env.ZG_CHAT_MODEL ?? "qwen3.7-flash",
  zgSttModel: process.env.ZG_STT_MODEL ?? "openai/whisper-large-v3",
  zgAudioChatModel: process.env.ZG_AUDIO_CHAT_MODEL ?? "qwen3.5-omni-flash",
  zgTrustMode: process.env.ZG_TRUST_MODE ?? "", // "", "verified" or "private"

  arkivAccessKey: process.env.ARKIV_ACCESS_KEY ?? "",
  relayKey: (process.env.RELAY_PRIVATE_KEY ?? "") as `0x${string}` | "",
  fundAmountEth: process.env.FUND_AMOUNT ?? "0.002",
  fundMinBalanceEth: process.env.FUND_MIN_BALANCE ?? "0.0005",

  zgEvmRpc: process.env.ZG_EVM_RPC ?? "https://evmrpc-testnet.0g.ai",
  zgIndexerRpc: process.env.ZG_INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai",
  zgStorageKey: (process.env.ZG_STORAGE_PRIVATE_KEY || process.env.RELAY_PRIVATE_KEY || "") as string,
};

export function arkivRpcUrl(): string {
  const base = "https://rpc.rabdi.db-chain.testnet.arkiv.network";
  return serverEnv.arkivAccessKey ? `${base}/${encodeURIComponent(serverEnv.arkivAccessKey)}` : base;
}
