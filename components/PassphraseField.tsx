"use client";
import { useEffect, useState } from "react";
import { checkPassphrase, type Strength } from "@/lib/vault/passphrase";

const LABELS = ["Very weak", "Weak", "Fair", "Strong", "Very strong"];
const COLORS = ["bg-bad", "bg-bad", "bg-warn", "bg-ok", "bg-ok"];

/** Passphrase input with a live strength meter (zxcvbn, lazy-loaded). */
export function PassphraseField({
  value,
  onChange,
  onStrength,
  userInputs = [],
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onStrength: (s: Strength | null) => void;
  userInputs?: string[];
  autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  const [s, setS] = useState<Strength | null>(null);
  const inputsKey = userInputs.join("|");

  useEffect(() => {
    let alive = true;
    if (!value) {
      queueMicrotask(() => {
        if (!alive) return;
        setS(null);
        onStrength(null);
      });
      return () => {
        alive = false;
      };
    }
    void checkPassphrase(value, inputsKey ? inputsKey.split("|") : []).then((r) => {
      if (!alive) return;
      setS(r);
      onStrength(r);
    });
    return () => {
      alive = false;
    };
  }, [value, inputsKey, onStrength]);

  return (
    <div>
      <div className="relative">
        <input
          className="input pr-16"
          type={show ? "text" : "password"}
          autoComplete="new-password"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. choose a strong password"
          autoFocus={autoFocus}
          aria-describedby="pp-strength"
        />
        <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-text">
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={`h-1.5 flex-1 rounded-full ${s && s.score > i ? COLORS[s.score] : "bg-card-2"}`} />
        ))}
      </div>
      <p id="pp-strength" className={`mt-1.5 text-xs ${s?.ok ? "text-ok" : "text-muted"}`}>
        {s ? `${LABELS[s.score]} — ${s.message}` : "At least 8 characters. Two or three words work well."}
      </p>
    </div>
  );
}
