import type { Metadata } from "next";
import { Landing } from "@/components/landing/Landing";

export const metadata: Metadata = {
  title: "Moonvault — your cycle, privately",
  description:
    "A private period tracker. Entries are encrypted on your device, backed up to decentralized 0G Storage, owned by your wallet on Arkiv, and analysed by verifiable AI on 0G.",
};

export default function Home() {
  return <Landing />;
}
