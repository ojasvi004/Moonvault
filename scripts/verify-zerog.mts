import fs from "node:fs";

// Section 9 verification: 0G Private Computer (chat + request ID, transcription)
// and 0G Storage (upload/download round trip of ciphertext-shaped bytes).
// Run: npx tsx --env-file=.env.local scripts/verify-zerog.mts [ai|storage|all]
const which = process.argv[2] ?? "all";
const base = (process.env.ZG_BASE_URL ?? "https://router-api.0g.ai/v1").replace(/\/$/, "");
const model = process.env.ZG_CHAT_MODEL ?? "qwen3.7-flash";

if (which === "ai" || which === "all") {
  const key = process.env.ZG_API_KEY;
  if (!key) console.log("AI: skip (no ZG_API_KEY)");
  else {
    const s = Date.now();
    const res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 50, messages: [{ role: "user", content: 'Reply with the JSON {"ok":true}' }] }),
    });
    const body = await res.json();
    console.log("AI chat", res.status, `${Date.now() - s} ms`, "request_id:", body?.x_0g_trace?.request_id, "text:", body?.choices?.[0]?.message?.content);
    const stt = await fetch(`${base}/audio/transcriptions`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
      body: (() => {
        const fd = new FormData();
        fd.append("file", new Blob([new Uint8Array(1000)], { type: "audio/webm" }), "x.webm");
        fd.append("model", process.env.ZG_STT_MODEL ?? "openai/whisper-large-v3");
        return fd;
      })(),
    });
    console.log("AI transcription endpoint status:", stt.status, (await stt.text()).slice(0, 200));
    if (stt.status !== 200) {
      console.log("Testing audio fallback model (qwen3.5-omni-flash)...");
      const omni = await fetch(`${base}/chat/completions`, {
        method: "POST",
        headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: JSON.stringify({
          model: process.env.ZG_AUDIO_CHAT_MODEL ?? "qwen3.5-omni-flash",
          max_tokens: 30,
          messages: [{ role: "user", content: "Reply with ok" }],
        }),
      });
      const omniBody = await omni.json();
      console.log("Audio fallback model status:", omni.status, "text:", omniBody?.choices?.[0]?.message?.content);
    }
  }
}

if (which === "storage" || which === "all") {
  let pk = process.env.ZG_STORAGE_PRIVATE_KEY || process.env.RELAY_PRIVATE_KEY;
  if (!pk) {
    for (const envFile of [".env.local", ".env"]) {
      if (fs.existsSync(envFile)) {
        const text = fs.readFileSync(envFile, "utf8");
        const m = text.match(/^(?:ZG_STORAGE_PRIVATE_KEY|RELAY_PRIVATE_KEY)=(0x[a-fA-F0-9]{64})$/m);
        if (m && m[1].trim()) {
          pk = m[1].trim();
          break;
        }
      }
    }
  }
  if (!pk) console.log("Storage: skip (no key)");
  else {
    const { Indexer, MemData } = await import("@0gfoundation/0g-ts-sdk");
    const { ethers } = await import("ethers");
    const rpc = process.env.ZG_EVM_RPC ?? "https://evmrpc-testnet.0g.ai";
    const provider = new ethers.JsonRpcProvider(rpc);
    const signer = new ethers.Wallet(pk, provider);
    console.log("storage signer", signer.address, "balance", ethers.formatEther(await provider.getBalance(signer.address)));
    const indexer = new Indexer(process.env.ZG_INDEXER_RPC ?? "https://indexer-storage-testnet-turbo.0g.ai");
    const bytes = new Uint8Array([0x4d, 0x56, 0x42, 0x01, ...crypto.getRandomValues(new Uint8Array(4000))]);
    const file = new MemData(bytes);
    const [tree] = await file.merkleTree();
    const root = tree!.rootHash()!;
    let s = Date.now();
    const [tx, err] = await indexer.upload(file, rpc, signer as never);
    console.log("upload", err ? `ERR ${err.message}` : "ok", `${Date.now() - s} ms`, root, tx);
    s = Date.now();
    for (let i = 0; i < 6; i++) {
      const [blob, derr] = await indexer.downloadToBlob(root, { proof: true });
      if (!derr) {
        const back = new Uint8Array(await blob.arrayBuffer());
        console.log("download ok", `${Date.now() - s} ms`, "match:", back.length === bytes.length && back.every((b, j) => b === bytes[j]));
        break;
      }
      console.log("download attempt", i + 1, derr.message.slice(0, 120));
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
}
