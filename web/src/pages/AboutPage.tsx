import { useTranslation } from "react-i18next";

/* ── Design tokens (inline to keep this page self-contained) ── */
const BG = "#080c10";
const SURFACE = "#0d1117";
const CARD = "#111820";
const BORDER = "#1e2d3d";
const BORDER_DIM = "#16202c";
const TEXT = "#e8edf2";
const MUTED = "#6b8394";
const ACCENT = "#00e5ff";
const ACCENT2 = "#7b61ff";
const ACCENT3 = "#ff6b35";

const FONT_DISPLAY = "'Syne', sans-serif";
const FONT_MONO = "'Space Mono', monospace";

const NOISE_SVG =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.03'/%3E%3C/svg%3E\")";

export function AboutPage() {
  const { t } = useTranslation();

  return (
    <div
      className="min-h-screen antialiased"
      style={{ background: BG, color: TEXT, fontFamily: FONT_MONO, fontSize: 14, lineHeight: 1.7 }}
    >
      <style>{`
        @keyframes csFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes csPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
        .cs-fade-1 { animation: csFadeUp 0.6s ease both; }
        .cs-fade-2 { animation: csFadeUp 0.6s 0.1s ease both; }
        .cs-fade-3 { animation: csFadeUp 0.6s 0.2s ease both; }
        .cs-fade-4 { animation: csFadeUp 0.6s 0.3s ease both; }
        .cs-fade-5 { animation: csFadeUp 0.6s 0.4s ease both; }
        .cs-pulse { animation: csPulse 2s infinite; }
        .cs-card { transition: transform 0.3s, border-color 0.3s; position: relative; overflow: hidden; }
        .cs-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, ${ACCENT}, ${ACCENT2});
          transform: scaleX(0); transform-origin: left; transition: transform 0.3s;
        }
        .cs-card:hover { border-color: ${ACCENT} !important; transform: translateY(-4px); }
        .cs-card:hover::before { transform: scaleX(1); }
        .cs-linklet:hover { color: ${ACCENT} !important; }
      `}</style>

      {/* ── Noise overlay ── */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: NOISE_SVG, opacity: 0.4, zIndex: 9999 }}
      />

      {/* ── Sticky nav ── */}
      <header
        className="sticky top-0 z-40"
        style={{
          background: "rgba(8,12,16,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: `1px solid ${BORDER}`,
        }}
      >
        <div className="max-w-[1200px] mx-auto flex items-center justify-between px-12 py-5">
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="CodeShield" className="h-7 w-auto" />
            <span style={{ color: BORDER, userSelect: "none" }}>|</span>
            <span
              className="uppercase"
              style={{ color: MUTED, fontSize: 11, letterSpacing: "2px" }}
            >
              {t("about.header.subtitle")}
            </span>
          </div>
          <span
            className="uppercase"
            style={{
              fontSize: 10,
              letterSpacing: "2px",
              color: ACCENT,
              border: `1px solid ${ACCENT}33`,
              background: `${ACCENT}0d`,
              borderRadius: 4,
              padding: "5px 12px",
            }}
          >
            {t("about.footer.version")}
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <section
        className="relative overflow-hidden"
        style={{ minHeight: "100vh", padding: "120px 48px 80px", display: "flex", alignItems: "center" }}
      >
        {/* Grid background with radial mask */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(${BORDER} 1px, transparent 1px), linear-gradient(90deg, ${BORDER} 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            opacity: 0.3,
            maskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)",
          }}
        />
        {/* Central cyan glow */}
        <div
          className="absolute pointer-events-none"
          style={{
            width: 600,
            height: 600,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${ACCENT}14 0%, transparent 70%)`,
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
          }}
        />

        <div className="relative max-w-[1200px] mx-auto w-full">
          {/* Pulse badge */}
          <div
            className="cs-fade-1 inline-flex items-center gap-2 uppercase"
            style={{
              background: `${ACCENT}10`,
              border: `1px solid ${ACCENT}33`,
              borderRadius: 4,
              padding: "6px 14px",
              fontSize: 11,
              letterSpacing: "2px",
              color: ACCENT,
              marginBottom: 32,
            }}
          >
            <span
              className="cs-pulse"
              style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, display: "inline-block" }}
            />
            CodeShield · AI Code Review
          </div>

          <h1
            className="cs-fade-2"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: "clamp(48px, 7vw, 96px)",
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: "-3px",
              marginBottom: 24,
              maxWidth: "1000px",
              color: TEXT,
            }}
          >
            {t("about.hero.headline")}
          </h1>

          <p
            className="cs-fade-3"
            style={{ maxWidth: 640, color: MUTED, lineHeight: 1.8, marginBottom: 48, fontSize: 15 }}
          >
            {t("about.hero.subtext")}
          </p>

          {/* Divider + stat row */}
          <div
            className="cs-fade-4 flex flex-wrap"
            style={{
              gap: 48,
              marginTop: 40,
              paddingTop: 48,
              borderTop: `1px solid ${BORDER}`,
            }}
          >
            <HeroStat value="4" label={t("about.hero.stat1Label")} />
            <HeroStat value={t("about.hero.stat2Value")} label={t("about.hero.stat2Label")} />
            <HeroStat value={t("about.hero.stat3Value")} label={t("about.hero.stat3Label")} />
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <Section label={t("about.problem.title")} title={t("about.problem.subtitle")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { num: "01", icon: "schedule",   title: t("about.problem.card1Title"), desc: t("about.problem.card1Desc") },
            { num: "02", icon: "shuffle",    title: t("about.problem.card2Title"), desc: t("about.problem.card2Desc") },
            { num: "03", icon: "psychology", title: t("about.problem.card3Title"), desc: t("about.problem.card3Desc") },
          ].map((c) => (
            <div
              key={c.num}
              className="cs-card"
              style={{
                background: CARD,
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                padding: 28,
              }}
            >
              <span
                style={{
                  display: "block",
                  fontFamily: FONT_DISPLAY,
                  fontSize: 48,
                  fontWeight: 800,
                  color: BORDER,
                  lineHeight: 1,
                  marginBottom: 20,
                  letterSpacing: "-2px",
                }}
              >
                {c.num}
              </span>
              <div
                className="flex items-center justify-center"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 6,
                  background: `${ACCENT}10`,
                  border: `1px solid ${ACCENT}22`,
                  marginBottom: 18,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 17, color: ACCENT }}>
                  {c.icon}
                </span>
              </div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 10 }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── The Solution ── */}
      <Section label={t("about.solution.title")} title={t("about.solution.subtitle")} surface>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "bolt",            title: t("about.solution.point1Title"), desc: t("about.solution.point1Desc"), color: ACCENT  },
            { icon: "verified",        title: t("about.solution.point2Title"), desc: t("about.solution.point2Desc"), color: ACCENT2 },
            { icon: "search_insights", title: t("about.solution.point3Title"), desc: t("about.solution.point3Desc"), color: ACCENT3 },
          ].map((s) => (
            <div
              key={s.icon}
              className="cs-card"
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 28 }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: `${s.color}10`,
                  border: `1px solid ${s.color}33`,
                  marginBottom: 22,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19, color: s.color }}>
                  {s.icon}
                </span>
              </div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 10 }}>
                {s.title}
              </h3>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Tech Stack ── */}
      <Section label={t("about.stack.title")} title={t("about.stack.subtitle")}>
        <TechStack />
      </Section>

      {/* ── How It Works ── */}
      <Section label={t("about.pipeline.title")} title={t("about.pipeline.subtitle")} surface>
        <Pipeline />
      </Section>

      {/* ── End-to-End Flow ── */}
      <Section label={t("about.flow.title")} title={t("about.flow.subtitle")}>
        <p
          style={{
            color: MUTED,
            fontSize: 14,
            lineHeight: 1.7,
            maxWidth: 780,
            marginTop: -24,
            marginBottom: 48,
          }}
        >
          {t("about.flow.description")}
        </p>
        <FlowLegend />
        <div style={{ marginTop: 32 }}>
          <FullFlowGraph />
        </div>
      </Section>

      {/* ── Specialist Agents ── */}
      <Section label={t("about.specialists.title")} title={t("about.specialists.subtitle")}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <SpecialistCard icon="security"     accent="#ff5577" title={t("about.specialists.securityTitle")}    desc={t("about.specialists.securityDesc")}    examples={[t("about.specialists.securityEx1"),    t("about.specialists.securityEx2"),    t("about.specialists.securityEx3")]} />
          <SpecialistCard icon="bug_report"   accent={ACCENT}  title={t("about.specialists.correctnessTitle")} desc={t("about.specialists.correctnessDesc")} examples={[t("about.specialists.correctnessEx1"), t("about.specialists.correctnessEx2"), t("about.specialists.correctnessEx3")]} />
          <SpecialistCard icon="speed"        accent={ACCENT3} title={t("about.specialists.performanceTitle")} desc={t("about.specialists.performanceDesc")} examples={[t("about.specialists.performanceEx1"), t("about.specialists.performanceEx2"), t("about.specialists.performanceEx3")]} />
          <SpecialistCard icon="architecture" accent={ACCENT2} title={t("about.specialists.styleTitle")}       desc={t("about.specialists.styleDesc")}       examples={[t("about.specialists.styleEx1"),       t("about.specialists.styleEx2"),       t("about.specialists.styleEx3")]} />
        </div>
      </Section>

      {/* ── Architecture Decisions ── */}
      <Section label={t("about.decisions.title")} title={t("about.decisions.subtitle")} surface>
        <div style={{ border: `1px solid ${BORDER}`, borderRadius: 8, overflow: "hidden", background: CARD }}>
          {([
            { tag: "LangGraph",               title: t("about.decisions.langGraphTitle"),  desc: t("about.decisions.langGraphDesc") },
            { tag: "OpenAI gpt-4o",           title: t("about.decisions.llmTitle"),        desc: t("about.decisions.llmDesc") },
            { tag: "LangSmith Hub",           title: t("about.decisions.langSmithTitle"),  desc: t("about.decisions.langSmithDesc") },
            { tag: "Supabase",                title: t("about.decisions.supabaseTitle"),   desc: t("about.decisions.supabaseDesc") },
            { tag: "AWS App Runner",          title: t("about.decisions.appRunnerTitle"),  desc: t("about.decisions.appRunnerDesc") },
            { tag: "AWS Lambda",              title: t("about.decisions.lambdaTitle"),     desc: t("about.decisions.lambdaDesc") },
            { tag: "AWS SQS",                 title: t("about.decisions.sqsTitle"),        desc: t("about.decisions.sqsDesc") },
            { tag: "DynamoDB",                title: t("about.decisions.cacheTitle"),      desc: t("about.decisions.cacheDesc") },
          ] as { tag: string; title: string; desc: string }[]).map(({ tag, title, desc }, i, arr) => (
            <div
              key={tag}
              className="flex gap-6"
              style={{
                padding: "22px 24px",
                borderBottom: i < arr.length - 1 ? `1px solid ${BORDER_DIM}` : "none",
                background: i % 2 === 0 ? CARD : SURFACE,
              }}
            >
              <div style={{ flex: "0 0 160px", paddingTop: 2 }}>
                <span
                  className="uppercase"
                  style={{
                    display: "inline-block",
                    fontSize: 10,
                    letterSpacing: "1px",
                    background: `${ACCENT}0d`,
                    color: ACCENT,
                    border: `1px solid ${ACCENT}22`,
                    padding: "4px 10px",
                    borderRadius: 3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {tag}
                </span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p style={{ fontFamily: FONT_DISPLAY, fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 6 }}>
                  {title}
                </p>
                <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Infrastructure Philosophy ── */}
      <Section label={t("about.infra.title")} title={t("about.infra.subtitle")}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            { icon: "power_off",  title: t("about.infra.card1Title"), desc: t("about.infra.card1Desc") },
            { icon: "hub",        title: t("about.infra.card2Title"), desc: t("about.infra.card2Desc") },
            { icon: "terminal",   title: t("about.infra.card3Title"), desc: t("about.infra.card3Desc") },
          ].map((c) => (
            <div
              key={c.icon}
              className="cs-card"
              style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 28 }}
            >
              <div
                className="flex items-center justify-center"
                style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: `${ACCENT2}10`,
                  border: `1px solid ${ACCENT2}33`,
                  marginBottom: 22,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 19, color: ACCENT2 }}>
                  {c.icon}
                </span>
              </div>
              <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 10 }}>
                {c.title}
              </h3>
              <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7 }}>{c.desc}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Footer ── */}
      <footer
        className="flex items-center justify-between flex-wrap gap-4"
        style={{
          padding: "40px 48px",
          borderTop: `1px solid ${BORDER}`,
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div className="flex items-center gap-4">
          <img src="/logo.jpg" alt="CodeShield" style={{ height: 22, opacity: 0.35 }} />
          <span style={{ fontSize: 11, color: MUTED, letterSpacing: "0.5px" }}>
            {t("about.footer.copyright")}
          </span>
        </div>
        <div className="flex gap-2">
          <FooterBadge>{t("about.footer.version")}</FooterBadge>
          <FooterBadge>{t("about.footer.license")}</FooterBadge>
        </div>
      </footer>
    </div>
  );
}

/* ── Sub-components ── */

function Section({
  label,
  title,
  surface = false,
  children,
}: {
  label: string;
  title: string;
  surface?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section style={{ background: surface ? SURFACE : BG }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "100px 48px" }}>
        <div
          className="uppercase"
          style={{ fontSize: 11, letterSpacing: "3px", color: ACCENT, marginBottom: 12 }}
        >
          {label}
        </div>
        <h2
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: "clamp(32px, 4vw, 52px)",
            fontWeight: 800,
            letterSpacing: "-1.5px",
            lineHeight: 1,
            marginBottom: 32,
            color: TEXT,
            maxWidth: 900,
          }}
        >
          {title}
        </h2>
        <div
          style={{
            height: 1,
            width: "100%",
            background: `linear-gradient(90deg, ${ACCENT} 0%, transparent 60%)`,
            marginBottom: 56,
          }}
        />
        {children}
      </div>
    </section>
  );
}

function HeroStat({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ minWidth: 120 }}>
      <div
        style={{
          fontFamily: FONT_DISPLAY,
          fontSize: 40,
          fontWeight: 800,
          color: ACCENT,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        className="uppercase"
        style={{ fontSize: 11, letterSpacing: "1.5px", color: MUTED, marginTop: 6 }}
      >
        {label}
      </div>
    </div>
  );
}

function FooterBadge({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="uppercase"
      style={{
        fontSize: 10,
        letterSpacing: "1px",
        border: `1px solid ${BORDER}`,
        color: MUTED,
        padding: "4px 10px",
        borderRadius: 3,
      }}
    >
      {children}
    </span>
  );
}

function TechStack() {
  const { t } = useTranslation();

  const categories = [
    {
      label: t("about.stack.backendLabel"),
      icon: "terminal",
      color: ACCENT2,
      items: [
        { name: "Python 3.12", note: "runtime" },
        { name: "FastAPI", note: "API" },
        { name: "LangGraph", note: "orchestration" },
        { name: "LangChain OpenAI", note: "LLM" },
        { name: "Pydantic v2", note: "validation" },
        { name: "uv", note: "packages" },
      ],
    },
    {
      label: t("about.stack.frontendLabel"),
      icon: "web",
      color: ACCENT,
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
      color: "#22d3a1",
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
      color: ACCENT3,
      items: [
        { name: "AWS App Runner", note: "API host" },
        { name: "AWS Lambda", note: "worker" },
        { name: "AWS SQS", note: "queue" },
        { name: "DynamoDB", note: "cache + idempotency" },
        { name: "CloudFront + S3", note: "CDN" },
        { name: "Terraform", note: "IaC" },
        { name: "LangSmith", note: "observability" },
        { name: "OpenAI", note: "gpt-4o (primary)" },
        { name: "Anthropic Claude", note: "Sonnet 4.5 (fallback)" },
      ],
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      {categories.map((cat) => (
        <div
          key={cat.label}
          className="cs-card"
          style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 28 }}
        >
          <div
            className="flex items-center justify-center"
            style={{
              width: 36, height: 36, borderRadius: 6,
              background: `${cat.color}10`,
              border: `1px solid ${cat.color}33`,
              marginBottom: 18,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 17, color: cat.color }}>
              {cat.icon}
            </span>
          </div>
          <h3
            className="uppercase"
            style={{
              fontFamily: FONT_DISPLAY,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "2px",
              color: TEXT,
              marginBottom: 16,
            }}
          >
            {cat.label}
          </h3>
          <div className="flex flex-wrap gap-2">
            {cat.items.map((item) => (
              <div
                key={item.name}
                className="flex items-center gap-1.5"
                style={{
                  background: `${cat.color}0a`,
                  border: `1px solid ${cat.color}22`,
                  borderRadius: 3,
                  padding: "4px 10px",
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{item.name}</span>
                <span style={{ fontSize: 10, color: MUTED }}>{item.note}</span>
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
    { icon: "security",     label: "Security",    color: "#ff5577" },
    { icon: "bug_report",   label: "Correctness", color: ACCENT },
    { icon: "speed",        label: "Performance", color: ACCENT3 },
    { icon: "architecture", label: "Style",       color: ACCENT2 },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Phase 1 */}
      <div
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 28,
          overflowX: "auto",
        }}
      >
        <PhaseLabel num="01">{t("about.pipeline.phase1Label")}</PhaseLabel>
        <div className="flex items-start gap-2 min-w-max" style={{ marginTop: 28 }}>
          {mainSteps.map((step, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className="flex flex-col items-center text-center" style={{ width: 120 }}>
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 42, height: 42, borderRadius: 8,
                    background: `${ACCENT}10`,
                    border: `1px solid ${ACCENT}33`,
                    marginBottom: 12,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18, color: ACCENT }}>
                    {step.icon}
                  </span>
                </div>
                <span style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.3 }}>
                  {step.label}
                </span>
                <span style={{ fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>
                  {step.sub}
                </span>
              </div>
              {i < mainSteps.length - 1 && (
                <span
                  className="material-symbols-outlined"
                  style={{ fontSize: 16, color: BORDER, marginTop: -28, flexShrink: 0 }}
                >
                  arrow_forward
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phase 2: fan-out */}
      <div
        style={{
          background: CARD,
          border: `2px dashed ${BORDER}`,
          borderRadius: 8,
          padding: 28,
        }}
      >
        <div className="flex items-center justify-between flex-wrap gap-3" style={{ marginBottom: 22 }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: ACCENT }}>
              account_tree
            </span>
            <span style={{ fontFamily: FONT_DISPLAY, fontSize: 14, fontWeight: 700, color: TEXT }}>
              {t("about.pipeline.step6")}
            </span>
            <span style={{ fontSize: 10, color: MUTED }}>— {t("about.pipeline.step6Desc")}</span>
          </div>
          <PhaseLabel num="02">{t("about.pipeline.phase2Label")}</PhaseLabel>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" style={{ marginBottom: 20 }}>
          {agents.map((a) => (
            <div
              key={a.label}
              className="flex items-center gap-2"
              style={{
                padding: "10px 14px",
                borderRadius: 6,
                background: `${a.color}0d`,
                border: `1px solid ${a.color}33`,
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15, color: a.color }}>
                {a.icon}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT }}>{a.label}</span>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 11,
            color: MUTED,
            lineHeight: 1.7,
            borderTop: `1px solid ${BORDER_DIM}`,
            paddingTop: 16,
          }}
        >
          {t("about.pipeline.fanoutDesc")}
        </p>
      </div>

      {/* Phase 3: output */}
      <div
        style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 28 }}
      >
        <PhaseLabel num="03">{t("about.pipeline.phase3Label")}</PhaseLabel>
        <div className="flex items-center gap-3 flex-wrap" style={{ marginTop: 24 }}>
          <PipelineOutput icon="merge"       title={t("about.pipeline.step7")} sub={t("about.pipeline.step7Desc")} color={ACCENT}  />
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: BORDER }}>arrow_forward</span>
          <PipelineOutput icon="fact_check"  title={t("about.pipeline.step8")} sub={t("about.pipeline.step8Desc")} color={ACCENT2} />
          <span style={{ color: BORDER, fontFamily: FONT_MONO, userSelect: "none", fontSize: 14 }}>+</span>
          <PipelineOutput icon="database"    title={t("about.pipeline.step9")} sub={t("about.pipeline.step9Desc")} color={ACCENT3} />
        </div>
      </div>
    </div>
  );
}

function PipelineOutput({ icon, title, sub, color }: { icon: string; title: string; sub: string; color: string }) {
  return (
    <div
      className="flex items-center gap-2.5"
      style={{
        padding: "12px 16px",
        borderRadius: 6,
        background: `${color}0d`,
        border: `1px solid ${color}33`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>
        {icon}
      </span>
      <div>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 12, fontWeight: 700, color: TEXT }}>{title}</div>
        <div style={{ fontSize: 10, color: MUTED, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

function PhaseLabel({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className="flex items-center justify-center"
        style={{
          width: 22,
          height: 22,
          background: `${ACCENT}15`,
          border: `1px solid ${ACCENT}55`,
          borderRadius: "50%",
          fontSize: 10,
          fontWeight: 700,
          color: ACCENT,
          fontFamily: FONT_MONO,
        }}
      >
        {num}
      </span>
      <span
        className="uppercase"
        style={{ fontSize: 10, letterSpacing: "2px", color: MUTED }}
      >
        {children}
      </span>
    </div>
  );
}

function SpecialistCard({
  icon,
  accent,
  title,
  desc,
  examples,
}: {
  icon: string;
  accent: string;
  title: string;
  desc: string;
  examples: string[];
}) {
  return (
    <div
      className="cs-card"
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      <div style={{ height: 2, background: `linear-gradient(90deg, ${accent}, ${accent}00)` }} />
      <div style={{ padding: 28 }}>
        <div className="flex items-center gap-3" style={{ marginBottom: 16 }}>
          <div
            className="flex items-center justify-center"
            style={{
              width: 40, height: 40, borderRadius: 8,
              background: `${accent}10`,
              border: `1px solid ${accent}33`,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 19, color: accent }}>
              {icon}
            </span>
          </div>
          <h3 style={{ fontFamily: FONT_DISPLAY, fontSize: 18, fontWeight: 700, color: TEXT }}>
            {title}
          </h3>
        </div>
        <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.7, marginBottom: 18 }}>{desc}</p>
        <ul style={{ listStyle: "none", paddingTop: 16, borderTop: `1px solid ${BORDER_DIM}` }}>
          {examples.map((ex, i) => (
            <li
              key={i}
              className="flex items-start gap-2"
              style={{ fontSize: 12, color: TEXT, marginBottom: i < examples.length - 1 ? 10 : 0 }}
            >
              <span
                className="material-symbols-outlined flex-shrink-0"
                style={{ fontSize: 14, color: accent, marginTop: 1 }}
              >
                arrow_right
              </span>
              <span style={{ color: MUTED }}>{ex}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/* ── End-to-End Flow graph ── */

function FlowLegend() {
  const { t } = useTranslation();
  const items = [
    { color: ACCENT,  label: t("about.flow.legendSync") },
    { color: ACCENT2, label: t("about.flow.legendAsync") },
    { color: ACCENT3, label: t("about.flow.legendExternal") },
  ];
  return (
    <div className="flex flex-wrap" style={{ gap: 16 }}>
      {items.map((it) => (
        <div
          key={it.label}
          className="flex items-center"
          style={{
            gap: 8,
            padding: "6px 12px",
            borderRadius: 3,
            background: `${it.color}0d`,
            border: `1px solid ${it.color}33`,
          }}
        >
          <span
            style={{ width: 8, height: 8, borderRadius: "50%", background: it.color, display: "inline-block" }}
          />
          <span className="uppercase" style={{ fontSize: 10, letterSpacing: "1.5px", color: TEXT }}>
            {it.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function FlowNode({
  icon,
  title,
  sub,
  color = ACCENT,
  width = 180,
}: {
  icon: string;
  title: string;
  sub?: string;
  color?: string;
  width?: number | string;
}) {
  return (
    <div
      className="flex items-start"
      style={{
        gap: 12,
        padding: "14px 16px",
        borderRadius: 8,
        background: CARD,
        border: `1px solid ${color}44`,
        width,
        maxWidth: "100%",
      }}
    >
      <div
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: 6,
          background: `${color}10`,
          border: `1px solid ${color}33`,
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 16, color }}>
          {icon}
        </span>
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontFamily: FONT_DISPLAY, fontSize: 13, fontWeight: 700, color: TEXT, lineHeight: 1.2 }}>
          {title}
        </div>
        {sub && (
          <div style={{ fontSize: 10, color: MUTED, marginTop: 4, lineHeight: 1.4 }}>{sub}</div>
        )}
      </div>
    </div>
  );
}

function FlowNote({ color = MUTED, children }: { color?: string; children: React.ReactNode }) {
  return (
    <div
      className="uppercase"
      style={{
        fontSize: 10,
        letterSpacing: "1.5px",
        color,
        background: `${color}12`,
        border: `1px dashed ${color}44`,
        borderRadius: 3,
        padding: "4px 10px",
        textAlign: "center",
        fontFamily: FONT_MONO,
      }}
    >
      {children}
    </div>
  );
}

function FlowArrowDown({ color = ACCENT, label }: { color?: string; label?: string }) {
  return (
    <div className="flex flex-col items-center" style={{ gap: 4, padding: "4px 0" }}>
      <div style={{ width: 1, height: 18, background: `${color}66` }} />
      {label && (
        <span className="uppercase" style={{ fontSize: 9, letterSpacing: "1.5px", color: MUTED }}>
          {label}
        </span>
      )}
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 18, color, marginTop: label ? -2 : 0 }}
      >
        arrow_downward
      </span>
    </div>
  );
}

function FanoutFigure() {
  const agents = [
    { icon: "security",     label: "Security",    color: "#ff5577" },
    { icon: "bug_report",   label: "Correctness", color: ACCENT },
    { icon: "speed",        label: "Performance", color: ACCENT3 },
    { icon: "architecture", label: "Style",       color: ACCENT2 },
  ];
  return (
    <div
      style={{
        position: "relative",
        background: CARD,
        border: `2px dashed ${BORDER}`,
        borderRadius: 8,
        padding: "22px 20px 20px",
      }}
    >
      {/* Thin SVG overlay for fan-out + merge lines only */}
      <svg
        viewBox="0 0 400 120"
        preserveAspectRatio="none"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        {/* Fan-out from top center to 4 column centers */}
        {[50, 150, 250, 350].map((x) => (
          <line
            key={`out-${x}`}
            x1={200}
            y1={0}
            x2={x}
            y2={42}
            stroke={`${ACCENT}55`}
            strokeWidth="1"
          />
        ))}
        {/* Merge from 4 column centers to bottom center */}
        {[50, 150, 250, 350].map((x) => (
          <line
            key={`in-${x}`}
            x1={x}
            y1={78}
            x2={200}
            y2={120}
            stroke={`${ACCENT}55`}
            strokeWidth="1"
          />
        ))}
      </svg>

      <div className="flex items-center justify-center" style={{ marginBottom: 14, position: "relative" }}>
        <FlowNote color={ACCENT}>Send × enabled specialists</FlowNote>
      </div>
      <div
        className="grid grid-cols-2 sm:grid-cols-4"
        style={{ gap: 10, position: "relative" }}
      >
        {agents.map((a) => (
          <div
            key={a.label}
            className="flex flex-col items-center text-center"
            style={{
              padding: "14px 10px",
              borderRadius: 6,
              background: `${a.color}0d`,
              border: `1px solid ${a.color}44`,
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: a.color }}>
              {a.icon}
            </span>
            <div
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 12,
                fontWeight: 700,
                color: TEXT,
                marginTop: 6,
              }}
            >
              {a.label}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-center" style={{ marginTop: 14, position: "relative" }}>
        <FlowNote color={ACCENT}>ReAct · ≤ 6 tool rounds · OpenAI + GitHub tools</FlowNote>
      </div>
    </div>
  );
}

function FullFlowGraph() {
  const { t } = useTranslation();
  return (
    <div
      style={{
        background: SURFACE,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 28,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {/* 1. Trigger */}
      <div className="flex items-stretch" style={{ gap: 12, flexWrap: "wrap" }}>
        <FlowNode icon="person"    title="Developer"  sub="opens / updates a PR" color={MUTED} width={220} />
        <div className="flex items-center" style={{ color: BORDER }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
        </div>
        <FlowNode icon="commit"    title="GitHub PR"  sub="repository event" color={MUTED} width={220} />
        <div className="flex items-center" style={{ color: BORDER }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
        </div>
        <FlowNode icon="http"      title="Webhook"    sub={t("about.flow.noteHmac")} color={ACCENT} width={260} />
      </div>

      <FlowArrowDown color={ACCENT} />

      {/* 2. Ingress */}
      <FlowNode icon="dns" title="App Runner — FastAPI" sub="verify HMAC → idempotency → insert run → dispatch" color={ACCENT} width="100%" />

      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 10, marginTop: 6 }}
      >
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <FlowArrowDown color={ACCENT2} label={t("about.flow.noteIdem")} />
          <FlowNode icon="database"  title="DynamoDB cache" sub="install tokens · idempotency" color={ACCENT2} width="100%" />
        </div>
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <FlowArrowDown color={ACCENT} label="insert run row" />
          <FlowNode icon="storage"   title="Supabase"       sub="runs table" color={ACCENT} width="100%" />
        </div>
        <div className="flex flex-col items-center" style={{ gap: 6 }}>
          <FlowArrowDown color={ACCENT2} label={t("about.flow.noteDispatch")} />
          <FlowNode icon="queue"     title="SQS"            sub="durable, 960 s visibility" color={ACCENT2} width="100%" />
        </div>
      </div>

      <FlowArrowDown color={ACCENT2} label="SQS trigger" />

      {/* 3. Lambda worker */}
      <div className="flex items-stretch" style={{ gap: 12, flexWrap: "wrap" }}>
        <FlowNode
          icon="functions"
          title="Lambda worker"
          sub={t("about.flow.noteBootstrap")}
          color={ACCENT}
          width={340}
        />
        <div className="flex items-center" style={{ color: BORDER }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_forward</span>
        </div>
        <FlowNode
          icon="key"
          title="Secrets Manager"
          sub="GitHub PEM · OpenAI · LangSmith"
          color={ACCENT3}
          width={320}
        />
      </div>

      <FlowArrowDown color={ACCENT} label="invoke compiled_graph" />

      {/* 4. LangGraph */}
      <FlowNode
        icon="hub"
        title="Planner"
        sub="pulls prompt from LangSmith Hub · classifies PR · produces plan"
        color={ACCENT}
        width="100%"
      />

      <FlowArrowDown color={ACCENT} label={t("about.flow.noteFanout")} />

      <FanoutFigure />

      <FlowArrowDown color={ACCENT} label="merged findings" />

      <FlowNode
        icon="merge"
        title="Aggregator"
        sub={t("about.flow.noteAggregate")}
        color={ACCENT}
        width="100%"
      />

      {/* External services annotation band */}
      <div
        className="flex flex-wrap items-center"
        style={{
          gap: 10,
          marginTop: 4,
          padding: "10px 14px",
          background: `${ACCENT3}0a`,
          border: `1px dashed ${ACCENT3}44`,
          borderRadius: 6,
        }}
      >
        <span className="uppercase" style={{ fontSize: 10, letterSpacing: "1.5px", color: ACCENT3, fontFamily: FONT_MONO }}>
          specialists call
        </span>
        <ExternalChip icon="psychology" label="OpenAI gpt-4o-mini" />
        <ExternalChip icon="code" label="GitHub REST API" />
        <ExternalChip icon="visibility" label="LangSmith traces" />
      </div>

      <FlowArrowDown color={ACCENT} />

      {/* 5. Write-back */}
      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: 10 }}
      >
        <FlowNode icon="list_alt"   title="findings table"   sub="Supabase insert (service role)" color={ACCENT} width="100%" />
        <FlowNode icon="fact_check" title="GitHub Check Run" sub={t("about.flow.noteAnnotate")}  color={ACCENT} width="100%" />
        <FlowNode icon="bolt"       title="run_events"       sub="specialist.completed · run.completed" color={ACCENT} width="100%" />
      </div>

      <FlowArrowDown color={ACCENT2} label={t("about.flow.noteRealtime")} />

      {/* 6. Live display */}
      <FlowNode
        icon="dashboard"
        title="React dashboard"
        sub="TanStack Query fetch + Supabase Realtime postgres_changes"
        color={ACCENT}
        width="100%"
      />
    </div>
  );
}

function ExternalChip({ icon, label }: { icon: string; label: string }) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 6,
        padding: "4px 10px",
        borderRadius: 3,
        background: CARD,
        border: `1px solid ${ACCENT3}44`,
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: ACCENT3 }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, color: TEXT, fontWeight: 700 }}>{label}</span>
    </span>
  );
}
