import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

const features = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
      </svg>
    ),
    title: "Security",
    desc: "SQL injection, auth flaws, secret exposure, insecure dependencies.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: "Correctness",
    desc: "Null dereferences, off-by-one errors, race conditions, swallowed exceptions.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: "Performance",
    desc: "N+1 queries, blocking I/O in async code, memory leaks, missing indexes.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
      </svg>
    ),
    title: "Style",
    desc: "Naming inconsistencies, missing docs, dead code, non-idiomatic patterns.",
  },
];

export function SignInPage() {
  const { t } = useTranslation();
  const { signInWithGitHub } = useAuth();

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed] flex flex-col">

      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="font-semibold text-white tracking-tight">CodeShield</span>
          </div>
          <button
            onClick={() => void signInWithGitHub()}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white/80 hover:text-white border border-white/10 rounded-md hover:border-white/20 transition-all"
          >
            <GitHubIcon />
            {t("signIn.button")}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-28 pb-20">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 mb-8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          4 specialist agents · AI-powered code review
        </div>

        <h1 className="text-5xl sm:text-6xl font-bold tracking-tight text-white max-w-3xl leading-[1.1]">
          AI Code Review for{" "}
          <span className="bg-gradient-to-r from-white to-white/50 bg-clip-text text-transparent">
            GitHub Pull Requests
          </span>
        </h1>

        <p className="mt-6 text-lg text-white/50 max-w-xl leading-relaxed">
          Four specialist agents review every pull request for security vulnerabilities,
          logic errors, performance regressions, and style issues — automatically posted
          as GitHub Check Run annotations.
        </p>

        <div className="mt-10 flex flex-col sm:flex-row items-center gap-3">
          <button
            onClick={() => void signInWithGitHub()}
            className="flex items-center gap-2.5 px-5 py-2.5 bg-white text-black text-sm font-semibold rounded-lg hover:bg-white/90 transition-all shadow-lg shadow-white/10"
          >
            <GitHubIcon className="text-black" />
            {t("signIn.button")}
          </button>
        </div>

        {/* Fake terminal / check run preview */}
        <div className="mt-16 w-full max-w-2xl rounded-xl border border-white/[0.08] bg-[#111] overflow-hidden shadow-2xl shadow-black/50 text-left">
          <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/[0.06] bg-[#0d0d0d]">
            <span className="w-3 h-3 rounded-full bg-[#ff5f57]" />
            <span className="w-3 h-3 rounded-full bg-[#febc2e]" />
            <span className="w-3 h-3 rounded-full bg-[#28c840]" />
            <span className="ml-3 text-xs text-white/30">AI Code Review · pull_request #42</span>
          </div>
          <div className="p-5 space-y-2 font-mono text-xs">
            <p><span className="text-emerald-400">✓</span> <span className="text-white/40">planner</span> <span className="text-white/60">classified as feature · 3 files changed</span></p>
            <p><span className="text-emerald-400">✓</span> <span className="text-white/40">security</span> <span className="text-white/60">1 finding · SQL injection in</span> <span className="text-amber-400">src/db/queries.py:42</span></p>
            <p><span className="text-emerald-400">✓</span> <span className="text-white/40">correctness</span> <span className="text-white/60">no issues found</span></p>
            <p><span className="text-emerald-400">✓</span> <span className="text-white/40">performance</span> <span className="text-white/60">1 finding · N+1 query in</span> <span className="text-amber-400">src/api/users.py:87</span></p>
            <p><span className="text-emerald-400">✓</span> <span className="text-white/40">style</span> <span className="text-white/60">no issues found</span></p>
            <p className="pt-1 border-t border-white/[0.06]"><span className="text-red-400">✗ request_changes</span> <span className="text-white/40">· 2 findings · $0.004</span></p>
          </div>
        </div>
      </main>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-6 pb-24 w-full">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border border-white/[0.08] bg-[#111] p-5 hover:border-white/20 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center text-white/70 mb-4">
                {f.icon}
              </div>
              <h3 className="font-semibold text-white text-sm mb-1">{f.title}</h3>
              <p className="text-xs text-white/40 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/[0.06] py-6 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-white/30">
          <span>© 2026 CodeShield</span>
          <span>LangGraph · Supabase · FastAPI</span>
        </div>
      </footer>
    </div>
  );
}

function GitHubIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`h-4 w-4 fill-current ${className}`} aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844a9.59 9.59 0 012.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
