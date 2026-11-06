/** Renders the light markdown our AI answers use (bullets, short headings, "Tip:" / "This week:" lines). */
export function AiText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[0.95rem] leading-relaxed">
      {text
        .split("\n")
        .filter((l) => l.trim())
        .map((l, i) => {
          const t = l.trim().replace(/\*\*/g, "");
          if (/^[-•*]\s/.test(t))
            return (
              <p key={i} className="flex gap-2">
                <span className="text-accent">•</span>
                <span>{t.replace(/^[-•*]\s/, "")}</span>
              </p>
            );
          if (/^tip:/i.test(t)) return <p key={i} className="mt-2 rounded-xl bg-accent/10 p-3 text-sm">{t}</p>;
          if (/^this week:/i.test(t)) return <p key={i} className="mt-2 rounded-xl bg-lav-soft p-3 text-sm">{t}</p>;
          if (t.length < 40 && !/[.!?]$/.test(t)) return <p key={i} className="font-display mt-3 text-lg">{t.replace(/^#+\s*/, "")}</p>;
          return <p key={i}>{t}</p>;
        })}
    </div>
  );
}
