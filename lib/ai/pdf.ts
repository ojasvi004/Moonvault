// One-page doctor summary PDF, built entirely in the browser (jspdf, lazy-loaded).
import { computeStats } from "@/lib/cycle/cycle";
import { addDays, formatDate, todayISO } from "@/lib/cycle/dates";
import type { Entry } from "@/lib/types";

export async function buildSummaryPdf(entries: Entry[], aiText: string, requestIds: string[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 44;
  const today = todayISO();
  const from = addDays(today, -183);
  const recent = entries.filter((e) => e.date >= from);
  const s = computeStats(recent);
  let y = M;

  doc.setFillColor(13, 10, 24);
  doc.rect(0, 0, W, 70, "F");
  doc.setTextColor(245, 237, 228);
  doc.setFont("times", "normal");
  doc.setFontSize(20);
  doc.text("Cycle summary for my doctor", M, 42);
  doc.setFontSize(9);
  doc.text(`${formatDate(from, { day: "numeric", month: "short", year: "numeric" })} – ${formatDate(today, { day: "numeric", month: "short", year: "numeric" })}`, W - M, 42, { align: "right" });
  y = 96;

  // Key numbers
  doc.setTextColor(30, 26, 36);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  const boxes: [string, string][] = [
    ["Avg cycle", `${s.avgCycle} d`],
    ["Avg period", `${s.avgPeriod} d`],
    ["Range", s.shortest ? `${s.shortest}–${s.longest} d` : "—"],
    ["Cycles", String(s.cyclesTracked)],
    ["Days logged", String(recent.length)],
  ];
  const bw = (W - 2 * M - 4 * 8) / 5;
  boxes.forEach(([k, v], i) => {
    const x = M + i * (bw + 8);
    doc.setDrawColor(228, 223, 233);
    doc.roundedRect(x, y, bw, 44, 6, 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(91, 85, 104);
    doc.text(k, x + 8, y + 15);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(30, 26, 36);
    doc.text(v, x + 8, y + 34);
  });
  y += 62;

  // Period starts
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Period starts (length):", M, y);
  doc.setFont("helvetica", "normal");
  const starts = s.periods.map((p) => `${formatDate(p.start)} (${p.length}d)`).join(" · ") || "none logged";
  const sLines = doc.splitTextToSize(starts, W - 2 * M - 110);
  doc.text(sLines.slice(0, 3), M + 110, y);
  y += 14 * Math.min(3, sLines.length) + 10;

  // AI summary
  doc.setDrawColor(228, 223, 233);
  doc.line(M, y, W - M, y);
  y += 18;
  const headings = new Set(["Cycle overview", "Bleeding pattern", "Symptoms", "Mood and sleep", "Questions to ask"]);
  for (const raw of aiText.split("\n")) {
    const line = raw.trim().replace(/^#+\s*/, "").replace(/\*\*/g, "");
    if (!line) continue;
    if (y > H - 80) break; // keep it to one page
    if (headings.has(line.replace(/:$/, ""))) {
      y += 4;
      doc.setFont("times", "bold");
      doc.setFontSize(12);
      doc.setTextColor(30, 26, 36);
      doc.text(line.replace(/:$/, ""), M, y);
      y += 15;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(50, 46, 58);
      const wrapped = doc.splitTextToSize(line.replace(/^[-•]\s*/, "• "), W - 2 * M - 8);
      doc.text(wrapped, M + 8, y);
      y += 12.5 * wrapped.length + 2;
    }
  }

  // Footer
  doc.setFontSize(7.5);
  doc.setTextColor(120, 114, 134);
  doc.text("Prepared by the patient with Moonvault. Self-reported data; informational only, not a diagnosis.", M, H - 40);
  doc.text(`AI summary Verification ID: ${requestIds.join(", ")}`, M, H - 28);
  return doc.output("blob");
}
