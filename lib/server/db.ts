import "server-only";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { MongoClient, Db } from "mongodb";

export type StoredShare = {
  entityKey: string;
  owner: string;
  shareId: string;
  scope: string;
  createdAt: number;
  expiresAtMs: number;
  pointer?: string;
  payloadHex?: string;
};

export type StoredPartner = {
  id: string;
  owner: string;
  writeHash: string;
  payload: string;
  createdAt: number;
  updatedAt: number;
  partner?: string;
  wrapped?: string;
  partnerHash?: string;
  claimedAt?: number;
};

export type StoredProfile = {
  entityKey: string;
  owner: string;
  wrapped: unknown;
  backupRoot?: string;
  backupAt?: number;
  expiresAtMs?: number;
};

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const uri = process.env.MONGODB_URI ?? "";

let clientPromise: Promise<MongoClient> | null = null;
if (uri) {
  if (!global._mongoClientPromise) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
}

async function getMongoDb(): Promise<Db | null> {
  if (!clientPromise) return null;
  try {
    const client = await clientPromise;
    return client.db("moonvault");
  } catch (err) {
    console.warn("[DB] MongoDB connection unavailable, falling back to disk store:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Fallback disk path that never throws EROFS on Vercel
const FALLBACK_BASE =
  process.env.MOONVAULT_DATA_DIR ||
  (process.env.VERCEL ? path.join(os.tmpdir(), "moonvault-storage") : path.join(process.cwd(), ".moonvault-storage"));

const dirFor = (sub: string) => path.join(FALLBACK_BASE, sub);

async function ensureFallbackDir(sub: string) {
  await fs.mkdir(dirFor(sub), { recursive: true }).catch(() => undefined);
}

// ------------------------------------------------------------------ Shares (Doctor Links)

export async function saveShare(share: StoredShare): Promise<void> {
  const db = await getMongoDb();
  if (db) {
    await db.collection<StoredShare>("shares").updateOne(
      { shareId: share.shareId },
      { $set: share },
      { upsert: true }
    );
    return;
  }

  // Fallback to disk
  await ensureFallbackDir("shares");
  const file = path.join(dirFor("shares"), `${share.shareId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(share, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function getShare(shareId: string): Promise<StoredShare | null> {
  const db = await getMongoDb();
  if (db) {
    const doc = await db.collection<StoredShare>("shares").findOne({ shareId });
    if (!doc || doc.expiresAtMs <= Date.now()) return null;
    return {
      entityKey: doc.entityKey,
      owner: doc.owner,
      shareId: doc.shareId,
      scope: doc.scope,
      createdAt: doc.createdAt,
      expiresAtMs: doc.expiresAtMs,
      pointer: doc.pointer,
      payloadHex: doc.payloadHex,
    };
  }

  // Fallback to disk
  try {
    const file = path.join(dirFor("shares"), `${shareId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
    const data = await fs.readFile(file, "utf8");
    const s = JSON.parse(data) as StoredShare;
    if (s.expiresAtMs <= Date.now()) return null;
    return s;
  } catch {
    return null;
  }
}

export async function listSharesByOwner(owner: string): Promise<StoredShare[]> {
  const normOwner = owner.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    const docs = await db
      .collection<StoredShare>("shares")
      .find({ owner: { $regex: new RegExp(`^${normOwner}$`, "i") }, expiresAtMs: { $gt: Date.now() } })
      .toArray();
    return docs.map((doc) => ({
      entityKey: doc.entityKey,
      owner: doc.owner,
      shareId: doc.shareId,
      scope: doc.scope,
      createdAt: doc.createdAt,
      expiresAtMs: doc.expiresAtMs,
      pointer: doc.pointer,
      payloadHex: doc.payloadHex,
    }));
  }

  // Fallback to disk
  try {
    await ensureFallbackDir("shares");
    const files = await fs.readdir(dirFor("shares"));
    const shares: StoredShare[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const content = await fs.readFile(path.join(dirFor("shares"), f), "utf8");
        const s = JSON.parse(content) as StoredShare;
        if (s.owner?.toLowerCase() === normOwner && s.expiresAtMs > Date.now()) {
          shares.push(s);
        }
      } catch {
        /* ignore corrupt files */
      }
    }
    return shares;
  } catch {
    return [];
  }
}

export async function deleteShare(shareId: string): Promise<void> {
  const db = await getMongoDb();
  if (db) {
    await db.collection("shares").deleteOne({ shareId });
    return;
  }

  const file = path.join(dirFor("shares"), `${shareId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`);
  await fs.unlink(file).catch(() => undefined);
}

// ------------------------------------------------------------------ Partners

export async function savePartner(p: StoredPartner): Promise<void> {
  const db = await getMongoDb();
  if (db) {
    await db.collection<StoredPartner>("partners").updateOne(
      { id: p.id },
      { $set: p },
      { upsert: true }
    );
    return;
  }

  // Fallback to disk
  await ensureFallbackDir("partners");
  const file = path.join(dirFor("partners"), `${p.id}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(p), "utf8");
  await fs.rename(tmp, file);
}

export async function getPartner(id: string): Promise<StoredPartner | null> {
  const db = await getMongoDb();
  if (db) {
    const doc = await db.collection<StoredPartner>("partners").findOne({ id });
    if (!doc) return null;
    return {
      id: doc.id,
      owner: doc.owner,
      writeHash: doc.writeHash,
      payload: doc.payload,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      partner: doc.partner,
      wrapped: doc.wrapped,
      partnerHash: doc.partnerHash,
      claimedAt: doc.claimedAt,
    };
  }

  // Fallback to disk
  try {
    const file = path.join(dirFor("partners"), `${id}.json`);
    return JSON.parse(await fs.readFile(file, "utf8")) as StoredPartner;
  } catch {
    return null;
  }
}

export async function listPartnersFor(partnerAddress: string): Promise<StoredPartner[]> {
  const norm = partnerAddress.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    const docs = await db
      .collection<StoredPartner>("partners")
      .find({ partner: norm, wrapped: { $exists: true, $ne: "" } })
      .toArray();
    return docs.map((doc) => ({
      id: doc.id,
      owner: doc.owner,
      writeHash: doc.writeHash,
      payload: doc.payload,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      partner: doc.partner,
      wrapped: doc.wrapped,
      partnerHash: doc.partnerHash,
      claimedAt: doc.claimedAt,
    }));
  }

  // Fallback to disk
  try {
    await ensureFallbackDir("partners");
    const files = await fs.readdir(dirFor("partners"));
    const links: StoredPartner[] = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      try {
        const s = JSON.parse(await fs.readFile(path.join(dirFor("partners"), f), "utf8")) as StoredPartner;
        if (s?.partner === norm && s.wrapped) links.push(s);
      } catch {
        /* ignore */
      }
    }
    return links;
  } catch {
    return [];
  }
}

export async function deletePartner(id: string): Promise<void> {
  const db = await getMongoDb();
  if (db) {
    await db.collection("partners").deleteOne({ id });
    return;
  }

  const file = path.join(dirFor("partners"), `${id}.json`);
  await fs.unlink(file).catch(() => undefined);
}

// ------------------------------------------------------------------ Profiles

export async function saveProfile(owner: string, p: StoredProfile): Promise<void> {
  const norm = owner.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    await db.collection<StoredProfile>("profiles").updateOne(
      { owner: norm },
      { $set: { ...p, owner: norm } },
      { upsert: true }
    );
    return;
  }

  // Fallback to disk
  await ensureFallbackDir("profiles");
  const file = path.join(dirFor("profiles"), `${norm}.json`);
  const tmp = `${file}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(p, null, 2), "utf8");
  await fs.rename(tmp, file);
}

export async function getProfile(owner: string): Promise<StoredProfile | null> {
  const norm = owner.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    const doc = await db.collection<StoredProfile>("profiles").findOne({ owner: norm });
    if (!doc) return null;
    return {
      entityKey: doc.entityKey,
      owner: doc.owner,
      wrapped: doc.wrapped,
      backupRoot: doc.backupRoot,
      backupAt: doc.backupAt,
      expiresAtMs: doc.expiresAtMs,
    };
  }

  // Fallback to disk
  try {
    const file = path.join(dirFor("profiles"), `${norm}.json`);
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data) as StoredProfile;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ Storage Blobs (0G backup cache)

export async function saveBlob(root: string, bytes: Uint8Array): Promise<void> {
  const norm = root.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    const b64 = Buffer.from(bytes).toString("base64");
    await db.collection("storage_blobs").updateOne(
      { root: norm },
      { $set: { root: norm, dataBase64: b64, createdAt: Date.now() } },
      { upsert: true }
    );
    return;
  }

  // Fallback to disk
  await ensureFallbackDir("blobs");
  const file = path.join(dirFor("blobs"), `${norm}.bin`);
  await fs.writeFile(file, bytes).catch(() => undefined);
}

export async function getBlob(root: string): Promise<Uint8Array | null> {
  const norm = root.toLowerCase();
  const db = await getMongoDb();
  if (db) {
    const doc = await db.collection<{ root: string; dataBase64: string }>("storage_blobs").findOne({ root: norm });
    if (doc?.dataBase64) {
      return new Uint8Array(Buffer.from(doc.dataBase64, "base64"));
    }
  }

  // Fallback to disk
  try {
    const file = path.join(dirFor("blobs"), `${norm}.bin`);
    const buf = await fs.readFile(file);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}
