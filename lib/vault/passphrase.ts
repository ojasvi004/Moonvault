// Passphrase policy: at least 12 characters and a zxcvbn score >= 3.
// The wrapped key sits in a public record, so a weak passphrase could be
// guessed offline; this is explained to the user in one sentence.
export const MIN_LENGTH = 12;
export const MIN_SCORE = 3;

export type Strength = { score: number; ok: boolean; message: string };

let zx: Promise<typeof import("zxcvbn")> | null = null;

export async function checkPassphrase(p: string, userInputs: string[] = []): Promise<Strength> {
  if (!zx) zx = import("zxcvbn").then((m) => (m.default ?? m) as typeof import("zxcvbn"));
  const zxcvbn = await zx;
  const r = zxcvbn(p.slice(0, 128), [...userInputs, "moonvault", "period", "cycle"]);
  if (p.length < MIN_LENGTH) return { score: r.score, ok: false, message: `Use at least ${MIN_LENGTH} characters.` };
  if (r.score < MIN_SCORE) {
    return { score: r.score, ok: false, message: r.feedback.warning || r.feedback.suggestions[0] || "Add more unusual words." };
  }
  return { score: r.score, ok: true, message: r.score === 4 ? "Very strong." : "Strong enough." };
}
