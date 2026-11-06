// Section 9 verification: Arkiv writes through the app's real ArkivAdapter.
// Needs RELAY_PRIVATE_KEY funded with tGLM (https://hub.arkiv.network/faucet).
// Run: npx tsx --env-file=.env.local scripts/verify-arkiv-write.mts
import fs from "node:fs";
import { privateKeyToAccount } from "viem/accounts";
import { ArkivAdapter } from "../lib/adapters/arkiv/adapter";
import { arkivPublic } from "../lib/adapters/arkiv/client";

let key = process.env.RELAY_PRIVATE_KEY as `0x${string}` | undefined;
if (!key) {
  for (const envFile of [".env.local", ".env"]) {
    if (fs.existsSync(envFile)) {
      const match = fs.readFileSync(envFile, "utf8").match(/^RELAY_PRIVATE_KEY=(.+)$/m);
      if (match && match[1].trim()) {
        key = match[1].trim() as `0x${string}`;
        break;
      }
    }
  }
}
if (!key) throw new Error("Set RELAY_PRIVATE_KEY");
const signer = privateKeyToAccount(key);
const a = new ArkivAdapter();
const t = (label: string) => {
  const s = Date.now();
  return () => console.log(`  ${label}: ${Date.now() - s} ms`);
};

console.log("signer", signer.address, "balance", await arkivPublic().getBalance({ address: signer.address }));

let done = t("create profile");
const wrapped = { v: 1 as const, kdf: { alg: "argon2id13" as const, opslimit: 2, memlimit: 67108864, salt: "AAAAAAAAAAAAAAAAAAAAAA" }, wrapped: "test-ciphertext" };
const p = await a.saveProfile(signer, { wrapped });
done();
console.log("profile entity", p.entityKey);

done = t("read profile by owner");
const got = await a.getProfile(signer.address);
done();
console.log("profile expires ~", got?.expiresAtMs ? new Date(got.expiresAtMs).toISOString() : "?", "block", got?.expiresAtBlock);

done = t("patch profile (backup pointer)");
await a.saveProfile(signer, { wrapped, backupRoot: "0x" + "ab".repeat(32), backupAt: Date.now() }, p.entityKey);
done();
console.log("backupRoot now", (await a.getProfile(signer.address))?.backupRoot);

done = t("extend profile");
await a.extendProfile(signer, p.entityKey);
done();

done = t("create share (2 min)");
const shareId = "verify-" + Date.now();
const s = await a.createShare(signer, { shareId, scope: "dates", createdAt: Date.now(), expiresAtMs: Date.now() + 120_000, payload: new Uint8Array(2048).fill(7) });
done();
console.log("share found:", Boolean(await a.getShare(shareId)), "listed:", (await a.listShares(signer.address)).length);

done = t("revoke share");
await a.revokeShare(signer, s.entityKey);
done();
console.log("share after revoke:", await a.getShare(shareId));

// Payload limit probe
for (const kb of [64, 96]) {
  try {
    const r = await a.createShare(signer, { shareId: `size-${kb}-${Date.now()}`, scope: "dates", createdAt: Date.now(), expiresAtMs: Date.now() + 60_000, payload: new Uint8Array(kb * 1024).fill(1) });
    console.log(`  ${kb} KiB payload ok`);
    await a.revokeShare(signer, r.entityKey);
  } catch (e) {
    console.log(`  ${kb} KiB payload FAILED:`, (e as Error).message.slice(0, 160));
  }
}
console.log("done (test profile left in place; it is owned by the relay key)");
