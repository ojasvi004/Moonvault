// Passphrase policy: at least 8 characters and not trivially guessable
// (zxcvbn score >= 2, i.e. "Fair"). Argon2id (64 MiB per guess) makes each
// offline guess against the public wrapped key expensive, which is why a
// "fair" passphrase is acceptable here. See DECISIONS.md C8.
export const MIN_LENGTH = 8;
export const MIN_SCORE = 2;

export type Strength = { score: number; ok: boolean; message: string };

let zx: Promise<typeof import("zxcvbn")> | null = null;

export async function checkPassphrase(p: string, userInputs: string[] = []): Promise<Strength> {
  if (!zx) zx = import("zxcvbn").then((m) => (m.default ?? m) as typeof import("zxcvbn"));
  const zxcvbn = await zx;
  const r = zxcvbn(p.slice(0, 128), [...userInputs, "moonvault", "period", "cycle"]);
  if (p.length < MIN_LENGTH) return { score: r.score, ok: false, message: `Use at least ${MIN_LENGTH} characters.` };
  if (r.score < MIN_SCORE) {
    return { score: r.score, ok: false, message: "Too easy to guess. Add another word or a number." };
  }
  return { score: r.score, ok: true, message: r.score >= 3 ? "Strong." : "Good enough." };
}
