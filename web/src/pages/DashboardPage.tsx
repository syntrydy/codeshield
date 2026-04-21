import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProjects } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInstallBanner, setShowInstallBanner] = useState(searchParams.get("installed") === "1");

  useEffect(() => {
    if (showInstallBanner) {
      setSearchParams({}, { replace: true });
      const timer = setTimeout(() => setShowInstallBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showInstallBanner, setSearchParams]);

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">

      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="font-semibold tracking-tight text-white">CodeShield</span>
          </div>
          <button
            onClick={() => void signOut()}
            className="text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            {t("nav.signOut")}
          </button>
        </div>
      </header>

      {showInstallBanner && (
        <div className="flex items-center justify-center gap-2 bg-emerald-500/10 border-b border-emerald-500/20 text-emerald-400 text-sm py-2.5 px-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {t("dashboard.installSuccess")}
        </div>
      )}

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white">{t("dashboard.title")}</h1>
            <p className="text-sm text-white/40 mt-0.5">Repositories connected to CodeShield</p>
          </div>
          <a
            href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG}/installations/new`}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white text-black rounded-lg hover:bg-white/90 transition-all"
          >
            {t("dashboard.installCta")}
          </a>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border border-white/[0.06] bg-[#111] animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
            {t("common.error")}
          </div>
        )}

        {projects && projects.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-16 text-center">
            <svg className="w-10 h-10 mx-auto text-white/20 mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776" />
            </svg>
            <p className="text-sm text-white/40">{t("dashboard.empty")}</p>
          </div>
        )}

        <div className="space-y-3">
          {projects?.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/runs`}
              className="group flex items-center justify-between rounded-xl border border-white/[0.06] bg-[#111] px-5 py-4 hover:border-white/[0.12] hover:bg-[#161616] transition-all"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-white/50" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{project.github_repo_full_name}</p>
                  <p className="text-xs text-white/40 mt-0.5">
                    {project.default_branch} · {project.enabled_specialists.join(", ")}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-shrink-0 ml-4">
                <span className={`text-xs px-2 py-0.5 rounded-full border ${severityColor(project.severity_threshold)}`}>
                  {project.severity_threshold}
                </span>
                <svg className="w-4 h-4 text-white/20 group-hover:text-white/40 transition-colors" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

function severityColor(level: string): string {
  switch (level) {
    case "critical": return "text-red-400 border-red-500/30 bg-red-500/10";
    case "high": return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    case "medium": return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    default: return "text-white/40 border-white/10 bg-white/5";
  }
}
