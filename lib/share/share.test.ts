import { describe, expect, it } from "vitest";
import { generateDk } from "@/lib/crypto";
import { buildPackage, openPackage, sealPackage } from "./share";
import type { Entry } from "@/lib/types";
import { addDays, todayISO } from "@/lib/cycle/dates";

const today = todayISO();
const entries: Entry[] = [
  { id: "1", date: addDays(today, -10), flow: "heavy", symptoms: ["cramps"], mood: "low", sleepHours: 6, notes: "Saw Dr. Mehta", source: "manual", createdAt: 0, updatedAt: 0 },
  { id: "2", date: addDays(today, -3), flow: "none", symptoms: ["headache"], source: "manual", createdAt: 0, updatedAt: 0 },
];

describe("share packages", () => {
  it("dates scope contains only bleeding dates and flow", () => {
    const p = buildPackage(entries, "dates", 6, Date.now() + 1000);
    expect(p.entries).toEqual([{ date: entries[0].date, flow: "heavy" }]);
  });
  it("dates_symptoms scope omits mood, sleep and notes", () => {
    const p = buildPackage(entries, "dates_symptoms", 6, Date.now() + 1000);
    expect(p.entries).toHaveLength(2);
    expect(JSON.stringify(p)).not.toContain("Mehta");
    expect(JSON.stringify(p)).not.toContain("sleepHours");
  });
  it("full scope includes notes", () => {
    const p = buildPackage(entries, "full", 6, Date.now() + 1000);
    expect(JSON.stringify(p)).toContain("Mehta");
  });
  it("seals and opens with the share key, bound to the share id", async () => {
    const key = await generateDk();
    const pkg = buildPackage(entries, "full", 6, Date.now() + 1000);
    const sealed = await sealPackage(key, { ...pkg, shareId: "abc" });
    expect(new TextDecoder().decode(sealed)).not.toContain("Mehta");
    expect((await openPackage(key, sealed, "abc")).entries).toHaveLength(2);
    await expect(openPackage(key, sealed, "other")).rejects.toThrow();
    await expect(openPackage(await generateDk(), sealed, "abc")).rejects.toThrow();

    // Verify hex serialization round-trip (e.g. cloud store fallback)
    const hex = Array.from(sealed, (b) => b.toString(16).padStart(2, "0")).join("");
    const fromHex = new Uint8Array(hex.length / 2);
    for (let i = 0; i < fromHex.length; i++) fromHex[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
    const restored = await openPackage(key, fromHex, "abc");
    expect(restored.entries).toHaveLength(2);
  });
});
