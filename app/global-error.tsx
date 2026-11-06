"use client";

export const dynamic = "force-dynamic";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-[#0d0a18] text-[#fbf8f4]">
        <div className="text-center p-6 space-y-4">
          <h2 className="text-2xl font-semibold">Something went wrong</h2>
          <p className="text-sm text-neutral-400">An unexpected error occurred.</p>
          <button
            onClick={() => reset()}
            className="rounded-full bg-[#8257e6] px-5 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
