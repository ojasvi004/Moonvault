import { Suspense } from "react";
import { DoctorView } from "./DoctorView";

export const metadata = { title: "Shared cycle report · Moonvault", robots: { index: false, follow: false }, referrer: "no-referrer" as const };

async function WithParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DoctorView shareId={id} />;
}

export default function SharePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="paper min-h-dvh" />}>
      <WithParams params={params} />
    </Suspense>
  );
}
