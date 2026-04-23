import { useTranslation } from "react-i18next";

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-white font-body text-zinc-900 antialiased">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-zinc-100">
        <div className="px-10 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="CodeShield" className="h-8 w-auto" />
            <span className="text-zinc-200 select-none">|</span>
            <span className="text-sm font-medium text-zinc-400 tracking-tight">
              {t("about.header.subtitle")}
            </span>
          </div>
          <span className="text-[10px] font-mono text-zinc-400 border border-zinc-200 px-2.5 py-1 rounded-full">
            {t("about.footer.version")}
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative bg-zinc-950 text-white overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      >
        {/* Emerald glow */}
        <div
          className="absolute top-0 left-0 w-96 h-96 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)",
          }}
        />
        <div className="relative px-10 py-28">
          <div className="flex items-center gap-2 mb-8">
            <span
              className="material-symbols-outlined text-emerald-400"
              style={{ fontSize: "13px", fontVariationSettings: "'FILL' 1" }}
            >
              shield
            </span>
            <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-[0.2em]">
              CodeShield · AI Code Review
            </span>
          </div>

          <h1 className="text-6xl lg:text-7xl font-black tracking-tighter leading-[1.02] mb-8 max-w-4xl">
            {t("about.hero.headline")}
          </h1>

          <p className="text-zinc-400 text-xl leading-relaxed max-w-3xl mb-16 font-light">
            {t("about.hero.subtext")}
          </p>

          <div className="flex items-stretch gap-0 w-fit border border-zinc-800 rounded-2xl overflow-hidden">
            <HeroStat value="4" label={t("about.hero.stat1Label")} />
            <div className="w-px bg-zinc-800" />
            <HeroStat value={t("about.hero.stat2Value")} label={t("about.hero.stat2Label")} />
            <div className="w-px bg-zinc-800" />
            <HeroStat value={t("about.hero.stat3Value")} label={t("about.hero.stat3Label")} />
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="px-10 py-24 bg-white">
        <Eyebrow>{t("about.problem.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-950 mt-3 mb-14">
          {t("about.problem.subtitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { num: "01", icon: "schedule", title: t("about.problem.card1Title"), desc: t("about.problem.card1Desc") },
            { num: "02", icon: "shuffle",  title: t("about.problem.card2Title"), desc: t("about.problem.card2Desc") },
            { num: "03", icon: "psychology", title: t("about.problem.card3Title"), desc: t("about.problem.card3Desc") },
          ].map((c) => (
            <div key={c.num} className="group relative border border-zinc-100 rounded-2xl p-8 hover:border-zinc-300 hover:shadow-sm transition-all">
              <span className="block text-[56px] font-black text-zinc-100 leading-none mb-6 group-hover:text-zinc-200 transition-colors select-none">
                {c.num}
              </span>
              <div className="w-9 h-9 bg-zinc-950 rounded-xl flex items-center justify-center mb-5">
                <span className="material-symbols-outlined text-white" style={{ fontSize: "17px" }}>{c.icon}</span>
              </div>
              <h3 className="font-bold text-zinc-950 text-lg mb-3 tracking-tight">{c.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Solution ── */}
      <section className="px-10 py-24 bg-zinc-950 text-white">
        <Eyebrow light>{t("about.solution.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter mt-3 mb-14 max-w-2xl">
          {t("about.solution.subtitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "bolt",            title: t("about.solution.point1Title"), desc: t("about.solution.point1Desc") },
            { icon: "verified",        title: t("about.solution.point2Title"), desc: t("about.solution.point2Desc") },
            { icon: "search_insights", title: t("about.solution.point3Title"), desc: t("about.solution.point3Desc") },
          ].map((s) => (
            <div key={s.icon} className="border border-zinc-800 rounded-2xl p-7 hover:border-zinc-600 transition-colors">
              <div className="w-10 h-10 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-emerald-400" style={{ fontSize: "19px" }}>{s.icon}</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2 tracking-tight">{s.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="px-10 py-24 bg-white">
        <Eyebrow>{t("about.stack.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-950 mt-3 mb-14">
          {t("about.stack.subtitle")}
        </h2>
        <TechStack />
      </section>

      {/* ── How It Works ── */}
      <section className="px-10 py-24 bg-zinc-50">
        <Eyebrow>{t("about.pipeline.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-950 mt-3 mb-14">
          {t("about.pipeline.subtitle")}
        </h2>
        <Pipeline />
      </section>

      {/* ── Specialist Agents ── */}
      <section className="px-10 py-24 bg-white">
        <Eyebrow>{t("about.specialists.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-950 mt-3 mb-14">
          {t("about.specialists.subtitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SpecialistCard icon="security"     color="red"    title={t("about.specialists.securityTitle")}     desc={t("about.specialists.securityDesc")}     examples={[t("about.specialists.securityEx1"),     t("about.specialists.securityEx2"),     t("about.specialists.securityEx3")]} />
          <SpecialistCard icon="bug_report"   color="blue"   title={t("about.specialists.correctnessTitle")}  desc={t("about.specialists.correctnessDesc")}  examples={[t("about.specialists.correctnessEx1"),  t("about.specialists.correctnessEx2"),  t("about.specialists.correctnessEx3")]} />
          <SpecialistCard icon="speed"        color="amber"  title={t("about.specialists.performanceTitle")}  desc={t("about.specialists.performanceDesc")}  examples={[t("about.specialists.performanceEx1"),  t("about.specialists.performanceEx2"),  t("about.specialists.performanceEx3")]} />
          <SpecialistCard icon="architecture" color="violet" title={t("about.specialists.styleTitle")}        desc={t("about.specialists.styleDesc")}        examples={[t("about.specialists.styleEx1"),        t("about.specialists.styleEx2"),        t("about.specialists.styleEx3")]} />
        </div>
      </section>

      {/* ── Architecture Decisions ── */}
      <section className="px-10 py-24 bg-zinc-50">
        <Eyebrow>{t("about.decisions.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter text-zinc-950 mt-3 mb-14">
          {t("about.decisions.subtitle")}
        </h2>
        <div className="divide-y divide-zinc-100 border border-zinc-200 rounded-2xl overflow-hidden">
          {([
            { tag: "LangGraph",              title: t("about.decisions.langGraphTitle"),  desc: t("about.decisions.langGraphDesc") },
            { tag: "Anthropic Claude",       title: t("about.decisions.claudeTitle"),     desc: t("about.decisions.claudeDesc") },
            { tag: "LangSmith Hub",         title: t("about.decisions.langSmithTitle"),  desc: t("about.decisions.langSmithDesc") },
            { tag: "Supabase",              title: t("about.decisions.supabaseTitle"),   desc: t("about.decisions.supabaseDesc") },
            { tag: "AWS App Runner",        title: t("about.decisions.appRunnerTitle"),  desc: t("about.decisions.appRunnerDesc") },
            { tag: "AWS Lambda",            title: t("about.decisions.lambdaTitle"),     desc: t("about.decisions.lambdaDesc") },
            { tag: "AWS SQS",               title: t("about.decisions.sqsTitle"),        desc: t("about.decisions.sqsDesc") },
            { tag: "ElastiCache Serverless", title: t("about.decisions.redisTitle"),      desc: t("about.decisions.redisDesc") },
          ] as { tag: string; title: string; desc: string }[]).map(({ tag, title, desc }, i) => (
            <div key={tag} className={`flex gap-6 p-6 ${i % 2 === 0 ? "bg-white" : "bg-zinc-50/60"} hover:bg-zinc-50 transition-colors`}>
              <div className="flex-shrink-0 w-36 pt-0.5">
                <span className="inline-block text-[10px] font-mono font-semibold bg-zinc-950 text-white px-2.5 py-1 rounded-full whitespace-nowrap">
                  {tag}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-950 mb-1.5">{title}</p>
                <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Infrastructure Philosophy ── */}
      <section className="px-10 py-24 bg-zinc-950 text-white">
        <Eyebrow light>{t("about.infra.title")}</Eyebrow>
        <h2 className="text-4xl font-black tracking-tighter mt-3 mb-14 max-w-2xl">
          {t("about.infra.subtitle")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "power_off",  title: t("about.infra.card1Title"), desc: t("about.infra.card1Desc") },
            { icon: "hub",        title: t("about.infra.card2Title"), desc: t("about.infra.card2Desc") },
            { icon: "terminal",   title: t("about.infra.card3Title"), desc: t("about.infra.card3Desc") },
          ].map((c) => (
            <div key={c.icon} className="border border-zinc-800 rounded-2xl p-7 hover:border-zinc-600 transition-colors">
              <div className="w-10 h-10 bg-zinc-800 rounded-xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-zinc-300" style={{ fontSize: "19px" }}>{c.icon}</span>
              </div>
              <h3 className="font-bold text-white text-base mb-2 tracking-tight">{c.title}</h3>
              <p className="text-sm text-zinc-400 leading-relaxed">{c.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="px-10 py-10 bg-white border-t border-zinc-100 flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <img src="/logo.jpg" alt="CodeShield" className="h-6 w-auto opacity-40" />
          <span className="text-xs text-zinc-400">{t("about.footer.copyright")}</span>
        </div>
        <div className="flex gap-2">
          <span className="text-[10px] font-mono border border-zinc-200 text-zinc-400 px-2.5 py-1 rounded-full">
            {t("about.footer.version")}
          </span>
          <span className="text-[10px] font-mono border border-zinc-200 text-zinc-400 px-2.5 py-1 rounded-full">
            {t("about.footer.license")}
          </span>
        </div>
      </footer>

    </div>
  );
}

/* ── Sub-components ── */

function Eyebrow({ children, light = false }: { children: React.ReactNode; light?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-4 h-px bg-emerald-500 block" />
      <span className={`text-[10px] font-mono uppercase tracking-[0.18em] ${light ? "text-emerald-400" : "text-emerald-600"}`}>
        {children}
      </span>
    </div>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-8 py-6">
      <div className="text-3xl font-black font-mono text-white leading-none">{value}</div>
      <div className="text-[10px] font-mono text-zinc-500 mt-2 uppercase tracking-wider">{label}</div>
    </div>
  );
}

function TechStack() {
  const { t } = useTranslation();

  const categories = [
    {
      label: t("about.stack.backendLabel"),
      icon: "terminal",
      color: "text-violet-600 bg-violet-50 border-violet-100",
      items: [
        { name: "Python 3.12", note: "runtime" },
        { name: "FastAPI", note: "API" },
        { name: "LangGraph", note: "orchestration" },
        { name: "LangChain Anthropic", note: "LLM" },
        { name: "Pydantic v2", note: "validation" },
        { name: "uv", note: "packages" },
      ],
    },
    {
      label: t("about.stack.frontendLabel"),
      icon: "web",
      color: "text-blue-600 bg-blue-50 border-blue-100",
      items: [
        { name: "React 18", note: "UI" },
        { name: "TypeScript", note: "strict" },
        { name: "Vite", note: "build" },
        { name: "Tailwind CSS", note: "styling" },
        { name: "TanStack Query", note: "state" },
        { name: "react-i18next", note: "en + fr" },
      ],
    },
    {
      label: t("about.stack.dataLabel"),
      icon: "database",
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      items: [
        { name: "Supabase Postgres", note: "database" },
        { name: "pgvector", note: "vector search" },
        { name: "Supabase Auth", note: "GitHub OAuth" },
        { name: "Supabase Realtime", note: "live events" },
        { name: "Row-Level Security", note: "isolation" },
      ],
    },
    {
      label: t("about.stack.infraLabel"),
      icon: "cloud",
      color: "text-amber-600 bg-amber-50 border-amber-100",
      items: [
        { name: "AWS App Runner", note: "API host" },
        { name: "AWS Lambda", note: "worker" },
        { name: "AWS SQS", note: "queue" },
        { name: "ElastiCache", note: "Redis" },
        { name: "CloudFront + S3", note: "CDN" },
        { name: "Terraform", note: "IaC" },
        { name: "LangSmith", note: "observability" },
        { name: "Anthropic Claude", note: "Sonnet + Haiku" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {categories.map((cat) => (
        <div key={cat.label} className="border border-zinc-100 rounded-2xl p-7 hover:border-zinc-200 hover:shadow-sm transition-all">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center mb-5 ${cat.color}`}>
            <span className="material-symbols-outlined" style={{ fontSize: "17px" }}>{cat.icon}</span>
          </div>
          <h3 className="text-xs font-semibold text-zinc-950 uppercase tracking-wider mb-4">{cat.label}</h3>
          <div className="flex flex-wrap gap-2">
            {cat.items.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-100 rounded-full px-3 py-1.5">
                <span className="text-xs font-semibold text-zinc-800">{item.name}</span>
                <span className="text-[10px] font-mono text-zinc-400">{item.note}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Pipeline() {
  const { t } = useTranslation();

  const mainSteps = [
    { label: t("about.pipeline.step1"), sub: t("about.pipeline.step1Desc"), icon: "merge_type" },
    { label: t("about.pipeline.step2"), sub: t("about.pipeline.step2Desc"), icon: "http" },
    { label: t("about.pipeline.step3"), sub: t("about.pipeline.step3Desc"), icon: "cloud" },
    { label: t("about.pipeline.step4"), sub: t("about.pipeline.step4Desc"), icon: "queue" },
    { label: t("about.pipeline.step5"), sub: t("about.pipeline.step5Desc"), icon: "functions" },
  ];

  const agents = [
    { icon: "security",     label: "Security",     cls: "text-red-600    bg-red-50    border-red-100" },
    { icon: "bug_report",   label: "Correctness",  cls: "text-blue-600   bg-blue-50   border-blue-100" },
    { icon: "speed",        label: "Performance",  cls: "text-amber-600  bg-amber-50  border-amber-100" },
    { icon: "architecture", label: "Style",        cls: "text-violet-600 bg-violet-50 border-violet-100" },
  ];

  return (
    <div className="space-y-3">
      {/* Phase 1 */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-7 overflow-x-auto">
        <PhaseLabel num="01">{t("about.pipeline.phase1Label")}</PhaseLabel>
        <div className="flex items-start gap-2 min-w-max mt-6">
          {mainSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center text-center w-28">
                <div className="w-10 h-10 bg-zinc-950 rounded-xl flex items-center justify-center mb-3">
                  <span className="material-symbols-outlined text-white" style={{ fontSize: "17px" }}>{step.icon}</span>
                </div>
                <span className="text-xs font-semibold text-zinc-950 leading-tight">{step.label}</span>
                <span className="text-[10px] font-mono text-zinc-400 mt-1 leading-tight">{step.sub}</span>
              </div>
              {i < mainSteps.length - 1 && (
                <span className="material-symbols-outlined text-zinc-300 flex-shrink-0" style={{ fontSize: "16px", marginTop: "-18px" }}>
                  arrow_forward
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phase 2: Fan-out */}
      <div className="border-2 border-dashed border-zinc-200 rounded-2xl p-7 bg-white">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-zinc-400" style={{ fontSize: "18px" }}>account_tree</span>
            <span className="text-sm font-semibold text-zinc-950">{t("about.pipeline.step6")}</span>
            <span className="text-[10px] font-mono text-zinc-400">— {t("about.pipeline.step6Desc")}</span>
          </div>
          <PhaseLabel num="02">{t("about.pipeline.phase2Label")}</PhaseLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {agents.map((a) => (
            <div key={a.label} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${a.cls}`}>
              <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>{a.icon}</span>
              <span className="text-xs font-semibold">{a.label}</span>
            </div>
          ))}
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed border-t border-zinc-100 pt-4">
          {t("about.pipeline.fanoutDesc")}
        </p>
      </div>

      {/* Phase 3: Output */}
      <div className="bg-white border border-zinc-200 rounded-2xl p-7">
        <PhaseLabel num="03">{t("about.pipeline.phase3Label")}</PhaseLabel>
        <div className="flex items-center gap-3 flex-wrap mt-6">
          <div className="flex items-center gap-2.5 px-4 py-3 bg-zinc-950 text-white rounded-xl">
            <span className="material-symbols-outlined" style={{ fontSize: "15px" }}>merge</span>
            <div>
              <div className="text-xs font-semibold">{t("about.pipeline.step7")}</div>
              <div className="text-[10px] font-mono text-zinc-400">{t("about.pipeline.step7Desc")}</div>
            </div>
          </div>
          <span className="material-symbols-outlined text-zinc-300" style={{ fontSize: "16px" }}>arrow_forward</span>
          <div className="flex items-center gap-2.5 px-4 py-3 bg-emerald-50 border border-emerald-100 rounded-xl">
            <span className="material-symbols-outlined text-emerald-600" style={{ fontSize: "15px" }}>fact_check</span>
            <div>
              <div className="text-xs font-semibold text-zinc-950">{t("about.pipeline.step8")}</div>
              <div className="text-[10px] font-mono text-zinc-500">{t("about.pipeline.step8Desc")}</div>
            </div>
          </div>
          <span className="text-zinc-300 font-mono select-none text-sm">+</span>
          <div className="flex items-center gap-2.5 px-4 py-3 bg-blue-50 border border-blue-100 rounded-xl">
            <span className="material-symbols-outlined text-blue-600" style={{ fontSize: "15px" }}>database</span>
            <div>
              <div className="text-xs font-semibold text-zinc-950">{t("about.pipeline.step9")}</div>
              <div className="text-[10px] font-mono text-zinc-500">{t("about.pipeline.step9Desc")}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhaseLabel({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-5 h-5 bg-zinc-950 text-white text-[9px] font-mono font-bold rounded-full flex items-center justify-center flex-shrink-0">
        {num}
      </span>
      <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-wider">{children}</span>
    </div>
  );
}

type SpecialistColor = "red" | "blue" | "amber" | "violet";

const specialistTheme: Record<SpecialistColor, { bar: string; icon: string; badge: string }> = {
  red:    { bar: "bg-red-500",    icon: "text-red-600",    badge: "bg-red-50 border-red-100" },
  blue:   { bar: "bg-blue-500",   icon: "text-blue-600",   badge: "bg-blue-50 border-blue-100" },
  amber:  { bar: "bg-amber-500",  icon: "text-amber-600",  badge: "bg-amber-50 border-amber-100" },
  violet: { bar: "bg-violet-500", icon: "text-violet-600", badge: "bg-violet-50 border-violet-100" },
};

function SpecialistCard({ icon, color, title, desc, examples }: {
  icon: string; color: SpecialistColor; title: string; desc: string; examples: string[];
}) {
  const cls = specialistTheme[color];
  return (
    <div className="border border-zinc-100 rounded-2xl overflow-hidden hover:border-zinc-200 hover:shadow-sm transition-all">
      <div className={`h-1 w-full ${cls.bar}`} />
      <div className="p-7 space-y-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${cls.badge}`}>
            <span className={`material-symbols-outlined ${cls.icon}`} style={{ fontSize: "17px" }}>{icon}</span>
          </div>
          <h3 className="font-bold text-zinc-950 tracking-tight">{title}</h3>
        </div>
        <p className="text-sm text-zinc-500 leading-relaxed">{desc}</p>
        <ul className="space-y-2 pt-3 border-t border-zinc-50">
          {examples.map((ex, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-zinc-600">
              <span className="material-symbols-outlined text-zinc-300 flex-shrink-0 mt-0.5" style={{ fontSize: "12px" }}>
                arrow_right
              </span>
              {ex}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
