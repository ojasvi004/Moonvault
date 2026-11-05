import { describe, expect, it } from "vitest";
import { generateDk } from "@/lib/crypto";
import { CorruptBackupError, makeBundle, openBundle, sealBundle } from "./bundle";
import type { Entry } from "@/lib/types";

const entry: Entry = { id: "e1", date: "2026-10-01", flow: "medium", symptoms: ["cramps"], notes: "PRIVATE-NOTE", source: "manual", createdAt: 1, updatedAt: 1 };

describe("backup bundle", () => {
  it("round-trips and carries a manifest", async () => {
    const dk = await generateDk();
    const sealed = await sealBundle(dk, makeBundle({ entries: [entry], ai: [], shares: [] }));
    expect(new TextDecoder().decode(sealed)).not.toContain("PRIVATE-NOTE");
    const b = await openBundle(dk, sealed);
    expect(b.data.entries[0]).toEqual(entry);
    expect(b.manifest.segments[0].kind).toBe("full");
    expect(b.manifest.segments[0].counts.entries).toBe(1);
  });
  it("detects corruption, truncation and wrong keys", async () => {
    const dk = await generateDk();
    const sealed = await sealBundle(dk, makeBundle({ entries: [entry], ai: [], shares: [] }));
    const flipped = sealed.slice();
    flipped[sealed.length - 3] ^= 0xff;
    await expect(openBundle(dk, flipped)).rejects.toBeInstanceOf(CorruptBackupError);
    await expect(openBundle(dk, sealed.subarray(0, 20))).rejects.toBeInstanceOf(CorruptBackupError);
    await expect(openBundle(await generateDk(), sealed)).rejects.toBeInstanceOf(CorruptBackupError);
    await expect(openBundle(dk, new Uint8Array(100))).rejects.toBeInstanceOf(CorruptBackupError);
  });
});
