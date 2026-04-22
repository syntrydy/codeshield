import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

type SpecialistTab = "security" | "performance" | "architecture";

const TABS: SpecialistTab[] = ["security", "performance", "architecture"];

const CODE_SNIPPETS: Record<SpecialistTab, { lines: string[] }> = {
  security: {
    lines: [
      '@app.post("/upload")',
      "async def handle_file(file: UploadFile):",
      '    with open(f"/tmp/{file.filename}", "wb") as f:',
      "        content = await file.read()",
      "        f.write(content)",
      '    return {"status": "ok"}',
    ],
  },
  performance: {
    lines: [
      '@app.get("/users")',
      "async def get_users(db: Session):",
      "    users = db.query(User).all()",
      "    return [",
      '        {"id": u.id, "posts": db.query(Post)',
      "                          .filter_by(user_id=u.id)",
      "                          .count()}",
      "        for u in users",
      "    ]",
    ],
  },
  architecture: {
    lines: [
      "from app.models import User",
      "from app.services import email",
      "",
      "class UserController:",
      "    def delete_user(self, user_id: int):",
      "        user = User.query.get(user_id)",
      "        email.send_deletion_notice(user.email)",
      "        user.delete()",
    ],
  },
};

export function SignInPage() {
  const { t } = useTranslation();
  const { signInWithGitHub } = useAuth();
  const [activeTab, setActiveTab] = useState<SpecialistTab>("security");

  const installUrl = `https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG}/installations/new`;

  return (
    <div className="bg-background font-body text-on-surface min-h-screen">

      {/* Nav */}
      <header className="sticky top-0 w-full z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-md">
        <nav className="flex items-center justify-between px-6 h-14 max-w-[1200px] mx-auto">
          <img src="/logo.jpg" alt="CodeShield" className="h-10 w-auto" />
          <div className="hidden md:flex items-center gap-8">
            <a href="#specialists" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">{t("landing.navHowItWorks")}</a>
            <a href="#pricing" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">{t("landing.navPricing")}</a>
            <a href="#" className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors">{t("landing.navDocs")}</a>
            <button
              onClick={() => void signInWithGitHub()}
              className="text-zinc-500 text-sm hover:text-zinc-900 transition-colors"
            >
              {t("signIn.button")}
            </button>
          </div>
          <button
            onClick={() => void signInWithGitHub()}
            className="bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-medium active:scale-[0.98] transition-transform"
          >
            {t("landing.navInstall")}
          </button>
        </nav>
      </header>

      <main className="max-w-[1200px] mx-auto px-6">

        {/* Hero */}
        <section className="py-16 flex flex-col items-center text-center">
          <div className="max-w-[720px]">
            <h1 className="text-[48px] leading-[1.1] font-semibold tracking-tighter text-primary mb-4">
              {t("landing.heroHeadline")}
            </h1>
            <p className="text-on-surface-variant text-lg mb-10">
              {t("landing.heroSubtext")}
            </p>
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <button
                onClick={() => void signInWithGitHub()}
                className="bg-primary text-on-primary px-6 py-3 rounded text-sm font-medium active:scale-[0.98] transition-transform"
              >
                {t("landing.heroCtaPrimary")}
              </button>
              <a
                href={installUrl}
                className="bg-white border border-outline-variant px-6 py-3 rounded text-sm font-medium hover:bg-surface-container-low transition-colors"
              >
                {t("landing.heroCtaSecondary")}
              </a>
            </div>
          </div>

          {/* GitHub PR diff mock */}
          <div className="mt-16 w-full max-w-[900px] border border-zinc-200 rounded-lg overflow-hidden shadow-sm bg-white">
            <div className="bg-zinc-50 border-b border-zinc-200 px-4 py-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-zinc-400">account_tree</span>
                <span className="font-mono text-[12px] text-zinc-600">codeshield-ai / core-engine</span>
              </div>
              <span className="bg-secondary/10 text-secondary px-2 py-0.5 rounded-full text-[10px] font-bold">PR #421</span>
            </div>
            <div className="p-4 bg-white font-mono text-[13px] leading-6 text-left">
              <div className="flex bg-[#ffebe9] px-2">
                <span className="w-8 text-zinc-400 select-none">-12</span>
                <span className="text-[#cf222e]">- results = db.execute(f"SELECT * FROM users WHERE id = {"{user_id}"}")</span>
              </div>
              <div className="flex bg-[#dafbe1] px-2">
                <span className="w-8 text-zinc-400 select-none">+12</span>
                <span className="text-[#1a7f37]">+ results = db.execute("SELECT * FROM users WHERE id = %s", (user_id,))</span>
              </div>
              <div className="ml-8 my-3 border border-secondary rounded overflow-hidden">
                <div className="bg-secondary/5 px-3 py-2 flex items-center gap-2 border-b border-secondary/20">
                  <span
                    className="material-symbols-outlined text-secondary text-[16px]"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    verified_user
                  </span>
                  <span className="font-bold text-secondary text-[12px]">CodeShield Security Specialist</span>
                </div>
                <div className="p-3 bg-white text-zinc-800">
                  <p className="mb-2 text-sm">Found a potential <span className="font-bold text-error">SQL Injection</span> vulnerability.</p>
                  <p className="text-zinc-500 text-[12px]">The previous implementation used f-string formatting for query parameters, which allows malicious input to alter the SQL structure.</p>
                  <div className="mt-2 flex gap-2">
                    <span className="bg-error/10 text-error px-2 py-0.5 rounded text-[11px] font-medium">Critical</span>
                    <span className="bg-zinc-100 text-zinc-600 px-2 py-0.5 rounded text-[11px] font-medium">CWE-89</span>
                  </div>
                </div>
              </div>
              <div className="flex px-2">
                <span className="w-8 text-zinc-400 select-none">13</span>
                <span>  return results.fetchone()</span>
              </div>
            </div>
          </div>

          {/* Social proof */}
          <div className="mt-10 flex flex-col items-center gap-6">
            <p className="text-[12px] font-medium tracking-[0.05em] text-zinc-400 uppercase">{t("landing.socialProof")}</p>
            <div className="flex flex-wrap justify-center gap-16 opacity-40 grayscale">
              {["[ACME]", "[GLOBEX]", "[SOYLENT]", "[INITECH]"].map((name) => (
                <span key={name} className="text-[18px] font-semibold text-zinc-400 tracking-widest">{name}</span>
              ))}
            </div>
          </div>
        </section>

        {/* Specialists grid */}
        <section id="specialists" className="py-16">
          <div className="max-w-[720px] mx-auto mb-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight text-primary mb-2">{t("landing.specialistsTitle")}</h2>
            <p className="text-on-surface-variant">{t("landing.specialistsSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <SpecialistCard
              iconBgClass="bg-error/10 text-error"
              icon="shield"
              title={t("landing.securityTitle")}
              items={[t("landing.securityItem1"), t("landing.securityItem2"), t("landing.securityItem3")]}
              arrowClass="text-error"
            />
            <SpecialistCard
              iconBgClass="bg-secondary/10 text-secondary"
              icon="check_circle"
              title={t("landing.correctnessTitle")}
              items={[t("landing.correctnessItem1"), t("landing.correctnessItem2"), t("landing.correctnessItem3")]}
              arrowClass="text-secondary"
            />
            <SpecialistCard
              iconBgClass="bg-zinc-100 text-zinc-900"
              icon="speed"
              title={t("landing.performanceTitle")}
              items={[t("landing.performanceItem1"), t("landing.performanceItem2"), t("landing.performanceItem3")]}
              arrowClass="text-zinc-900"
            />
            <SpecialistCard
              iconBgClass="bg-zinc-100 text-zinc-600"
              icon="auto_awesome"
              title={t("landing.styleTitle")}
              items={[t("landing.styleItem1"), t("landing.styleItem2"), t("landing.styleItem3")]}
              arrowClass="text-zinc-400"
            />
          </div>
        </section>

        {/* Interactive review panel */}
        <section className="py-16">
          <div className="max-w-[720px] mx-auto mb-10">
            <h2 className="text-2xl font-semibold tracking-tight text-primary mb-2">{t("landing.reviewTitle")}</h2>
            <p className="text-on-surface-variant">{t("landing.reviewSubtitle")}</p>
          </div>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-white">
            <div className="flex border-b border-outline-variant bg-surface-container-low overflow-x-auto">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-4 text-[12px] font-medium tracking-[0.05em] border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab
                      ? "border-secondary text-secondary bg-white"
                      : "border-transparent text-on-surface-variant hover:text-primary"
                  }`}
                >
                  {tab.toUpperCase()}
                </button>
              ))}
            </div>
            <ReviewTabContent tab={activeTab} codeLines={CODE_SNIPPETS[activeTab].lines} />
          </div>
        </section>

        {/* Architecture */}
        <section className="py-16">
          <div className="max-w-[720px] mx-auto text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight text-primary mb-2">{t("landing.archTitle")}</h2>
            <p className="text-on-surface-variant">{t("landing.archSubtitle")}</p>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-center gap-2 md:gap-6 overflow-x-auto pb-4 flex-wrap">
            {[
              { icon: "browser_updated", label: "Browser" },
              null,
              { icon: "api", label: "FastAPI" },
              null,
              { icon: "database", label: "Celery" },
              null,
              { icon: "hub", label: "LangGraph", highlight: true },
              null,
              { icon: "terminal", label: "GitHub" },
            ].map((item, i) =>
              item === null ? (
                <div key={i} className="w-px h-8 md:w-8 md:h-px bg-outline-variant" />
              ) : (
                <div
                  key={item.label}
                  className={`flex flex-col items-center p-4 border rounded min-w-[120px] ${
                    item.highlight ? "border-secondary bg-secondary/5" : "border-outline-variant bg-white"
                  }`}
                >
                  <span className={`material-symbols-outlined mb-2 ${item.highlight ? "text-secondary" : "text-zinc-400"}`}>
                    {item.icon}
                  </span>
                  <span className={`font-mono text-[11px] font-bold ${item.highlight ? "text-secondary" : ""}`}>
                    {item.label}
                  </span>
                </div>
              )
            )}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16">
          <div className="max-w-[720px] mx-auto text-center mb-10">
            <h2 className="text-2xl font-semibold tracking-tight text-primary mb-2">{t("landing.pricingTitle")}</h2>
            <p className="text-on-surface-variant">{t("landing.pricingSubtitle")}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Free */}
            <div className="border border-outline-variant rounded-lg p-6 bg-white flex flex-col">
              <PricingHeader tier={t("landing.freeTier")} price={t("landing.freePrice")} period={t("landing.freePeriod")} />
              <PricingFeatureList features={[t("landing.freeFeature1"), t("landing.freeFeature2"), t("landing.freeFeature3")]} iconClass="text-zinc-400" />
              <button
                onClick={() => void signInWithGitHub()}
                className="w-full py-2 border border-outline-variant rounded font-medium text-sm hover:bg-surface-container-low transition-colors"
              >
                {t("landing.freeCta")}
              </button>
            </div>

            {/* Team */}
            <div className="border-2 border-secondary rounded-lg p-6 bg-white flex flex-col relative">
              <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-secondary text-white px-3 py-1 rounded-full text-[10px] font-bold tracking-wider">
                {t("landing.teamBadge")}
              </div>
              <PricingHeader tier={t("landing.teamTier")} tierClass="text-secondary" price={t("landing.teamPrice")} period={t("landing.teamPeriod")} />
              <PricingFeatureList features={[t("landing.teamFeature1"), t("landing.teamFeature2"), t("landing.teamFeature3"), t("landing.teamFeature4")]} iconClass="text-secondary" />
              <button
                onClick={() => void signInWithGitHub()}
                className="w-full py-2 bg-primary text-white rounded font-medium text-sm hover:bg-zinc-800 transition-colors"
              >
                {t("landing.teamCta")}
              </button>
            </div>

            {/* Enterprise */}
            <div className="border border-outline-variant rounded-lg p-6 bg-white flex flex-col">
              <PricingHeader tier={t("landing.enterpriseTier")} price={t("landing.enterprisePrice")} />
              <PricingFeatureList features={[t("landing.enterpriseFeature1"), t("landing.enterpriseFeature2"), t("landing.enterpriseFeature3"), t("landing.enterpriseFeature4")]} iconClass="text-zinc-400" />
              <button className="w-full py-2 border border-outline-variant rounded font-medium text-sm hover:bg-surface-container-low transition-colors">
                {t("landing.enterpriseCta")}
              </button>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-16 mb-16 border-t border-outline-variant">
          <div
            className="bg-zinc-950 text-white rounded-2xl p-10 flex flex-col md:flex-row items-center justify-between gap-6 overflow-hidden relative"
          >
            <div
              className="absolute inset-0 opacity-10 pointer-events-none"
              style={{
                backgroundImage: "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="relative z-10">
              <h2 className="text-[32px] leading-tight font-semibold mb-2">{t("landing.ctaHeadline")}</h2>
              <p className="text-zinc-400">{t("landing.ctaSubtext")}</p>
            </div>
            <div className="relative z-10 flex gap-4 flex-wrap">
              <button
                onClick={() => void signInWithGitHub()}
                className="bg-white text-zinc-950 px-8 py-3 rounded font-bold text-sm hover:bg-zinc-100 transition-colors"
              >
                {t("landing.ctaPrimary")}
              </button>
              <button className="bg-transparent border border-zinc-700 text-white px-8 py-3 rounded font-bold text-sm hover:bg-zinc-900 transition-colors">
                {t("landing.ctaSecondary")}
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-zinc-200 bg-white">
        <div className="flex flex-col md:flex-row items-center justify-between px-6 py-12 max-w-[1200px] mx-auto gap-4">
          <div className="flex flex-col gap-2">
            <img src="/logo.jpg" alt="CodeShield" className="h-10 w-auto" />
            <p className="text-xs text-zinc-500">{t("landing.footerCopyright")}</p>
          </div>
          <div className="flex items-center gap-6 flex-wrap justify-center">
            {(["footerSecurity", "footerPrivacy", "footerTerms", "footerChangelog", "footerStatus"] as const).map((key) => (
              <a key={key} href="#" className="text-xs text-zinc-500 hover:text-zinc-900 underline transition-colors">
                {t(`landing.${key}`)}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

function SpecialistCard({
  iconBgClass,
  icon,
  title,
  items,
  arrowClass,
}: {
  iconBgClass: string;
  icon: string;
  title: string;
  items: string[];
  arrowClass: string;
}) {
  return (
    <div className="border border-outline-variant p-6 rounded-lg bg-white">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-8 h-8 flex items-center justify-center rounded ${iconBgClass}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <h3 className="text-lg font-semibold tracking-tight text-primary">{title}</h3>
      </div>
      <ul className="space-y-3 font-mono text-[13px] text-zinc-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className={arrowClass}>→</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewTabContent({ tab, codeLines }: { tab: SpecialistTab; codeLines: string[] }) {
  const { t } = useTranslation();

  const finding = {
    security: {
      title: t("landing.pathTraversalTitle"),
      desc: t("landing.pathTraversalDesc"),
      fix: t("landing.pathTraversalFix"),
      severity: t("landing.highSeverity"),
      severityClass: "bg-error-container text-on-error-container",
    },
    performance: {
      title: t("landing.n1QueryTitle"),
      desc: t("landing.n1QueryDesc"),
      fix: t("landing.n1QueryFix"),
      severity: t("landing.mediumSeverity"),
      severityClass: "bg-yellow-100 text-yellow-800",
    },
    architecture: {
      title: t("landing.layerViolationTitle"),
      desc: t("landing.layerViolationDesc"),
      fix: t("landing.layerViolationFix"),
      severity: t("landing.lowSeverity"),
      severityClass: "bg-blue-100 text-blue-800",
    },
  }[tab];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2">
      <div className="p-6 bg-zinc-950 font-mono text-[13px] text-zinc-300 overflow-x-auto">
        <pre>
          <code>
            {codeLines.map((line, i) => (
              <div key={i}>
                <span className="text-zinc-500 select-none mr-3">{String(i + 1).padStart(2, " ")}</span>
                {line}
              </div>
            ))}
          </code>
        </pre>
      </div>
      <div className="p-6 border-l border-outline-variant flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[12px] font-medium tracking-[0.05em] text-zinc-500">{t("landing.findingCount")}</span>
          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${finding.severityClass}`}>{finding.severity}</span>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-primary mb-1">{finding.title}</h4>
          <p className="text-sm text-zinc-600 leading-relaxed">{finding.desc}</p>
        </div>
        <div className="mt-auto pt-4 border-t border-zinc-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-secondary text-[18px]">lightbulb</span>
            <span className="text-[12px] font-medium tracking-[0.05em] text-secondary">{t("landing.suggestedFix")}</span>
          </div>
          <p className="text-[12px] text-zinc-500 font-mono italic">{finding.fix}</p>
        </div>
      </div>
    </div>
  );
}

function PricingHeader({
  tier,
  tierClass = "text-zinc-500",
  price,
  period,
}: {
  tier: string;
  tierClass?: string;
  price: string;
  period?: string;
}) {
  return (
    <div className="mb-6">
      <h3 className={`text-[12px] font-medium tracking-[0.05em] mb-1 ${tierClass}`}>{tier}</h3>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tracking-tight text-primary">{price}</span>
        {period && <span className="text-[12px] font-medium text-zinc-500">{period}</span>}
      </div>
    </div>
  );
}

function PricingFeatureList({ features, iconClass }: { features: string[]; iconClass: string }) {
  return (
    <ul className="space-y-4 mb-16 flex-grow">
      {features.map((f) => (
        <li key={f} className="flex items-start gap-2 text-sm text-zinc-600">
          <span className={`material-symbols-outlined text-[18px] ${iconClass}`}>check_small</span>
          {f}
        </li>
      ))}
    </ul>
  );
}
