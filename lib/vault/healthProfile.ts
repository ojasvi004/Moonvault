import type { AiResult } from "@/lib/types";
import { listRecords, putRecord } from "./records";

export type HealthProfile = {
  avgCycleLength: number;
  avgPeriodLength: number;
  lastPeriodDate?: string;
  conditions: string[];
  notes?: string;
  updatedAt: number;
};

/** Stored in the "ai" record store for historical reasons; AI result views must skip it. */
export const PROFILE_RECORD_ID = "user-health-profile";

export async function getHealthProfile(): Promise<HealthProfile | null> {
  const all = await listRecords("ai");
  const found = all.find((r) => r.id === PROFILE_RECORD_ID);
  if (!found) return null;
  try {
    return JSON.parse(found.answer) as HealthProfile;
  } catch {
    return null;
  }
}

export async function saveHealthProfile(profile: Omit<HealthProfile, "updatedAt">): Promise<void> {
  const full: HealthProfile = {
    ...profile,
    updatedAt: Date.now(),
  };
  const record: AiResult = {
    id: PROFILE_RECORD_ID,
    kind: "insights",
    createdAt: Date.now(),
    question: "Health Profile & History",
    answer: JSON.stringify(full),
    requestIds: ["local-profile"],
    model: "local",
    mock: false,
  };
  await putRecord("ai", PROFILE_RECORD_ID, record);
}
