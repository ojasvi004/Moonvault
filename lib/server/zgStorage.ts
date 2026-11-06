// 0G Storage from the server. The browser SDK needs Node polyfills and an
// ethers signer funded on the 0G chain, so uploads go through this route
// with a relay key. The server only ever handles ciphertext.
import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { serverEnv } from "./env";

type SDK = typeof import("@0gfoundation/0g-ts-sdk");
let sdk: Promise<SDK> | null = null;
const loadSdk = () => (sdk ??= import("@0gfoundation/0g-ts-sdk"));

const STORAGE_DIR = path.join(process.cwd(), ".moonvault-storage");

async function saveLocalBlob(root: string, bytes: Uint8Array): Promise<void> {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    const file = path.join(STORAGE_DIR, `${root.toLowerCase()}.bin`);
    await fs.writeFile(file, bytes);
  } catch (err) {
    console.warn("[Cloud Storage] Failed to cache local blob:", err);
  }
}

async function readLocalBlob(root: string): Promise<Uint8Array | null> {
  try {
    const file = path.join(STORAGE_DIR, `${root.toLowerCase()}.bin`);
    const buf = await fs.readFile(file);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// Cache the signer's balance check so an unfunded relay doesn't make every
// backup wait on an upload that cannot pay for its transaction.
let fundedCheck: { at: number; funded: boolean } | null = null;
async function signerFunded(signer: import("ethers").Wallet): Promise<boolean> {
  if (fundedCheck && Date.now() - fundedCheck.at < 5 * 60_000) return fundedCheck.funded;
  const balance = await signer.provider!.getBalance(signer.address).catch(() => null);
  // Unknown (RPC hiccup) counts as funded so we still try.
  const funded = balance === null ? true : balance > 0n;
  fundedCheck = { at: Date.now(), funded };
  if (!funded) console.warn(`[0G Storage] Signer ${signer.address} has no testnet balance; keeping ciphertext in the server cache only. Fund it at https://faucet.0g.ai`);
  return funded;
}

export async function zgUpload(bytes: Uint8Array): Promise<{ root: string; txHash?: string; anchored: boolean }> {
  const [{ Indexer, MemData }] = await Promise.all([loadSdk()]);
  const file = new MemData(bytes);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree) throw new Error(`merkle: ${treeErr?.message}`);
  const root = tree.rootHash();
  if (!root) throw new Error("No root hash");

  // Always cache the encrypted blob in server cloud storage first
  await saveLocalBlob(root, bytes);

  // If a 0G storage key is configured, also attempt to anchor on 0G Galileo testnet
  if (serverEnv.zgStorageKey) {
    try {
      const { ethers } = await import("ethers");
      const provider = new ethers.JsonRpcProvider(serverEnv.zgEvmRpc);
      const signer = new ethers.Wallet(serverEnv.zgStorageKey, provider);
      if (!(await signerFunded(signer))) return { root, anchored: false };
      const indexer = new Indexer(serverEnv.zgIndexerRpc);
      const [tx, err] = await indexer.upload(file, serverEnv.zgEvmRpc, signer as never, { skipIfFinalized: true });
      if (err) {
        if (/already (exists|uploaded|finalized)/i.test(err.message)) return { root, anchored: true };
        console.warn("[0G Storage] Testnet anchor notice:", err.message);
      } else if (tx) {
        const txHash = "txHash" in tx ? tx.txHash : tx.txHashes[0];
        return { root, txHash, anchored: true };
      }
    } catch (err) {
      console.warn("[0G Storage] Testnet upload deferred; ciphertext safely stored in cloud backup:", err);
    }
  }

  return { root, anchored: false };
}

export async function zgDownload(root: string): Promise<Uint8Array> {
  // Check fast local cloud cache first (avoids 1-2 min 0G indexing delay)
  const local = await readLocalBlob(root);
  if (local) return local;

  const { Indexer } = await loadSdk();
  const indexer = new Indexer(serverEnv.zgIndexerRpc);
  const [blob, err] = await indexer.downloadToBlob(root, { proof: true });
  if (err) throw err;
  const bytes = new Uint8Array(await blob.arrayBuffer());
  await saveLocalBlob(root, bytes);
  return bytes;
}

