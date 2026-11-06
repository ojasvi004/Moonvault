// Tiny className joiner used by the fancy components (stands in for shadcn's `cn`).
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
