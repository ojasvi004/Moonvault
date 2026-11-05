// 0G Storage from the server. The browser SDK needs Node polyfills and an
// ethers signer funded on the 0G chain, so uploads go through this route
// with a relay key. The server only ever handles ciphertext.
import "server-only";
import { serverEnv } from "./env";

type SDK = typeof import("@0gfoundation/0g-ts-sdk");
let sdk: Promise<SDK> | null = null;
const loadSdk = () => (sdk ??= import("@0gfoundation/0g-ts-sdk"));

export async function zgUpload(bytes: Uint8Array): Promise<{ root: string; txHash?: string }> {
  if (!serverEnv.zgStorageKey) throw new Error("NOT_CONFIGURED");
  const [{ Indexer, MemData }, { ethers }] = await Promise.all([loadSdk(), import("ethers")]);
  const provider = new ethers.JsonRpcProvider(serverEnv.zgEvmRpc);
  const signer = new ethers.Wallet(serverEnv.zgStorageKey, provider);
  const indexer = new Indexer(serverEnv.zgIndexerRpc);
  const file = new MemData(bytes);
  const [tree, treeErr] = await file.merkleTree();
  if (treeErr || !tree) throw new Error(`merkle: ${treeErr?.message}`);
  const root = tree.rootHash();
  if (!root) throw new Error("No root hash");
  // Cast: the SDK bundles its own ethers types.
  const [tx, err] = await indexer.upload(file, serverEnv.zgEvmRpc, signer as never, { skipIfFinalized: true });
  if (err) {
    // Already stored (identical ciphertext) is a success.
    if (/already (exists|uploaded|finalized)/i.test(err.message)) return { root };
    throw err;
  }
  const txHash = "txHash" in tx ? tx.txHash : tx.txHashes[0];
  return { root, txHash };
}

export async function zgDownload(root: string): Promise<Uint8Array> {
  const { Indexer } = await loadSdk();
  const indexer = new Indexer(serverEnv.zgIndexerRpc);
  const [blob, err] = await indexer.downloadToBlob(root, { proof: true });
  if (err) throw err;
  return new Uint8Array(await blob.arrayBuffer());
}
