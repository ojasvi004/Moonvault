export const FLOWS = ["none", "spotting", "light", "medium", "heavy"] as const;
export type Flow = (typeof FLOWS)[number];

export const MOODS = ["great", "good", "okay", "low", "bad"] as const;
export type Mood = (typeof MOODS)[number];

export const SYMPTOMS = [
  "cramps",
  "headache",
  "bloating",
  "fatigue",
  "acne",
  "back pain",
  "breast tenderness",
  "nausea",
  "cravings",
  "irritability",
  "anxiety",
  "insomnia",
] as const;

export type Entry = {
  id: string;
  date: string; // YYYY-MM-DD (local)
  flow: Flow;
  symptoms: string[];
  symptomsText?: string;
  mood?: Mood;
  sleepHours?: number;
  notes?: string;
  source: "manual" | "voice";
  createdAt: number;
  updatedAt: number;
};

export type AiKind = "ask" | "insights" | "summary" | "voice";

export type AiResult = {
  id: string;
  kind: AiKind;
  createdAt: number;
  question?: string;
  answer: string;
  requestIds: string[]; // 0G request IDs ("Verification IDs" in the UI)
  model?: string;
  mock?: boolean;
};

export type ShareScope = "dates" | "dates_symptoms" | "full";

export const SCOPE_LABELS: Record<ShareScope, string> = {
  dates: "Period dates only",
  dates_symptoms: "Dates + symptoms",
  full: "Everything",
};

/** Local (encrypted) record of a share I created. Recipient label never leaves the device. */
export type LocalShare = {
  shareId: string;
  entityKey: string;
  recipientLabel: string;
  scope: ShareScope;
  createdAt: number;
  expiresAt: number;
  link: string; // includes the key fragment so the owner can re-copy it
  revoked?: boolean;
};

/** Decrypted share package as seen by the recipient. */
export type SharePackage = {
  v: 1;
  scope: ShareScope;
  createdAt: number;
  expiresAt: number;
  range: { from: string; to: string };
  entries: Array<Partial<Entry> & { date: string }>;
  stats?: { avgCycle?: number; avgPeriod?: number; cycles?: number };
};
