// Reports which integrations are configured (booleans only, never values).
import { serverEnv } from "@/lib/server/env";
import { json } from "@/lib/server/rateLimit";

export async function GET() {
  return json({
    ok: true,
    mock: process.env.NEXT_PUBLIC_MOCK_SERVICES === "true",
    thirdweb: Boolean(process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID),
    ai: Boolean(serverEnv.zgApiKey),
    aiModel: serverEnv.zgChatModel,
    arkivAccessKey: Boolean(serverEnv.arkivAccessKey),
    relay: Boolean(serverEnv.relayKey),
    storage: Boolean(serverEnv.zgStorageKey),
  });
}
