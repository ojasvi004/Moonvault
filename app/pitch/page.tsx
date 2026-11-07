import type { Metadata } from "next";
import { PitchDeck } from "@/components/pitch/PitchDeck";

export const metadata: Metadata = {
  title: "Moonvault — ETHGlobal Mumbai Pitch Deck | Sovereign FemTech on Arkiv & 0G",
  description:
    "Pitch deck for Moonvault at ETHGlobal Mumbai 2026. Powered by client-side encryption, verifiable AI on 0G, decentralized backups, and self-expiring Arkiv records.",
};

export default function PitchPage() {
  return <PitchDeck />;
}
