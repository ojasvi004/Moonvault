// Verifies that IndexedDB only ever holds ciphertext.
import { describe, expect, it } from "vitest";
import { getDb } from "./db";
import { createVault, unlockVault } from "./vault";
import { saveEntry, listEntries } from "./entries";
import { lock, isUnlocked } from "./session";
import { countPending, markBackedUp } from "./records";
import { WrongPassphraseError } from "@/lib/crypto";

const PASS = "orbit lantern mango quietly";

describe("vault", () => {
  it("stores only ciphertext and unlocks with the passphrase", async () => {
    await createVault("0xABC", PASS);
    await saveEntry({ date: "2026-10-02", flow: "heavy", symptoms: ["cramps"], notes: "SECRET-NOTE-123", source: "manual" });

    const db = await getDb();
    const rows = await db.getAll("entries");
    expect(rows).toHaveLength(1);
    const asText = new TextDecoder("latin1").decode(rows[0].ct);
    expect(asText).not.toContain("SECRET-NOTE-123");
    expect(asText).not.toContain("2026-10-02");
    expect(Object.keys(rows[0]).sort()).toEqual(["backedUp", "ct", "id", "updatedAt"]);

    const meta = await db.get("meta", "vault");
    expect(JSON.stringify(meta)).not.toContain(PASS);
    expect(await countPending()).toBe(1);

    lock();
    expect(isUnlocked()).toBe(false);
    await expect(unlockVault("wrong passphrase entirely")).rejects.toBeInstanceOf(WrongPassphraseError);
    await unlockVault(PASS);
    const entries = await listEntries();
    expect(entries[0].notes).toBe("SECRET-NOTE-123");

    await markBackedUp(Date.now());
    expect(await countPending()).toBe(0);
  }, 30000);
});
