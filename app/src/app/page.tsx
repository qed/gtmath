import Link from "next/link";

export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-[var(--s-5)] text-center">
      <h1 className="mb-[var(--s-3)]">GTMath</h1>
      <p
        className="text-ink-3 text-xl mb-[var(--s-7)] max-w-[480px]"
        style={{ fontFamily: "var(--font-editorial)", fontStyle: "italic" }}
      >
        Math meets strategy. Deal cards, combine numbers, hit the target.
      </p>

      <div className="flex flex-col gap-[var(--s-3)] w-full max-w-[320px]">
        <Link
          href="/pin"
          className="flex items-center justify-center h-14 bg-alpha-blue text-white font-bold text-lg
                     hover:bg-alpha-blue-600 active:bg-alpha-blue-700 transition-colors"
          style={{
            borderRadius: "var(--r-pill)",
            fontFamily: "var(--font-display)",
          }}
        >
          Play
        </Link>

        <Link
          href="/login"
          className="flex items-center justify-center h-14 border-2 border-alpha-blue text-alpha-blue font-bold text-lg
                     hover:bg-alpha-sky-soft transition-colors"
          style={{
            borderRadius: "var(--r-pill)",
            fontFamily: "var(--font-display)",
          }}
        >
          Parent sign-in
        </Link>
      </div>

    </main>
  );
}
