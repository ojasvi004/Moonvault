import { describe, expect, it } from "vitest";
import { AUTO_BACKUP_THRESHOLD } from "@/lib/config";
import { countPending, markBackedUp } from "@/lib/vault/records";
import { createVault } from "@/lib/vault/vault";
import { saveEntry } from "@/lib/vault/entries";
import { makeBundle, openBundle, sealBundle } from "./bundle";
import { generateDk } from "@/lib/crypto";

const PASS = "gentle river forest midnight";

describe("automatic backup and data storage", () => {
  it("has AUTO_BACKUP_THRESHOLD set to 1 so every data entry triggers automatic backup", () => {
    expect(AUTO_BACKUP_THRESHOLD).toBe(1);
  });

  it("stores entries locally and tracks pending backup status automatically", async () => {
    await createVault("0x1234567890123456789012345678901234567890", PASS);
    const initialPending = await countPending();

    await saveEntry({
      date: "2026-11-01",
      flow: "medium",
      symptoms: ["headache", "fatigue"],
      notes: "Auto-saved entry test",
      source: "manual",
    });

    const pendingAfter = await countPending();
    expect(pendingAfter).toBe(initialPending + 1);

    // Verify auto backup threshold condition
    expect(pendingAfter >= AUTO_BACKUP_THRESHOLD).toBe(true);

    // Simulate successful backup completion
    const now = Date.now();
    await markBackedUp(now);
    expect(await countPending()).toBe(0);
  });

  it("creates sealed bundle and restores data correctly", async () => {
    const dk = await generateDk();
    const entry = {
      id: "auto-1",
      date: "2026-11-02",
      flow: "light" as const,
      symptoms: ["cramps"],
      notes: "Encrypted for automatic backup",
      source: "manual" as const,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const bundle = makeBundle({ entries: [entry], ai: [], shares: [] });
    const sealed = await sealBundle(dk, bundle);

    expect(sealed.length).toBeGreaterThan(0);
    // Envelope magic check: MVB\x01
    expect(sealed[0]).toBe(0x4d); // M
    expect(sealed[1]).toBe(0x56); // V
    expect(sealed[2]).toBe(0x42); // B
    expect(sealed[3]).toBe(0x01); // 0x01

    const opened = await openBundle(dk, sealed);
    expect(opened.data.entries[0].notes).toBe("Encrypted for automatic backup");
    expect(opened.data.entries[0].date).toBe("2026-11-02");
  });
});
