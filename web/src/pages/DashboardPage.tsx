import { useEffect, useState } from "react";
import { useQuery, useQueries } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProjects, fetchRuns, type Project, type Run } from "../lib/api";
import { AppLayout } from "../components/AppLayout";

type RunWithProject = Run & { project: Project };

export function DashboardPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showInstallBanner, setShowInstallBanner] = useState(searchParams.get("installed") === "1");

  useEffect(() => {
    if (showInstallBanner) {
      setSearchParams({}, { replace: true });
      const timer = setTimeout(() => setShowInstallBanner(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showInstallBanner, setSearchParams]);

  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const projectList = projects ?? [];

  const runsQueries = useQueries({
    queries: projectList.map((p) => ({
      queryKey: ["runs", p.id] as const,
      queryFn: () => fetchRuns(p.id),
      enabled: !!projects,
    })),
  });

  const allRuns: RunWithProject[] = runsQueries.flatMap((q, i) =>
    (q.data ?? []).map((r) => ({ ...r, project: projectList[i] }))
  );

  const totalProjects = projectList.length;
  const pendingReviews = allRuns.filter((r) => r.status === "queued" || r.status === "running").length;
  const totalRuns = allRuns.filter((r) => r.status === "completed").length;
  const totalCost = allRuns.reduce((sum, r) => sum + r.total_cost_usd, 0);

  const recentRuns = [...allRuns]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8);

  const healthProjects = projectList.slice(0, 4).map((p) => {
    const projectRuns = allRuns.filter((r) => r.project_id === p.id);
    const lastRun = [...projectRuns].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0];
    return { project: p, lastRun };
  });

  const installUrl = `https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG}/installations/new`;
  const latestProject = healthProjects[0]?.project.github_repo_full_name.split("/")[1] ?? "your-repo";

  return (
    <AppLayout
      activePage="home"
      breadcrumb={t("dashboard.breadcrumb")}
      hasProjects={projectList.length > 0}
    >
      {/* Install success banner */}
      {showInstallBanner && (
        <div className="flex items-center justify-center gap-2 bg-emerald-50 border-b border-emerald-200 text-emerald-700 text-sm py-2.5 px-4">
          <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          {t("dashboard.installSuccess")}
        </div>
      )}

      {projectsError && (
        <div className="mx-8 mt-6 border border-red-200 bg-red-50 px-5 py-3 rounded-lg text-sm text-red-600">
          {t("common.error")}
        </div>
      )}

      {projectsLoading ? (
        <LoadingSkeleton />
      ) : projects !== undefined && projects.length === 0 ? (
        <InstallScreen installUrl={installUrl} />
      ) : (
        <main className="p-8 max-w-[1280px] w-full mx-auto space-y-8">

          {/* Stats */}
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              label={t("dashboard.stats.totalProjects")}
              value={totalProjects}
              icon="check_circle"
              sub={t("dashboard.stats.totalProjectsSub")}
            />
            <StatCard
              label={t("dashboard.stats.pendingReviews")}
              value={pendingReviews}
              icon="hourglass_empty"
              sub={t("dashboard.stats.pendingReviewsSub")}
            />
            <StatCard
              label={t("dashboard.stats.totalRuns")}
              value={totalRuns}
              icon="fact_check"
              sub={t("dashboard.stats.totalRunsSub")}
              highlight={totalRuns === 0 ? undefined : "normal"}
            />
            <StatCard
              label={t("dashboard.stats.totalCost")}
              value={`$${totalCost.toFixed(4)}`}
              icon="bolt"
              sub={t("dashboard.stats.totalCostSub")}
            />
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

            {/* Recent Pull Requests */}
            <section className="lg:col-span-2 space-y-4">
              <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{t("dashboard.recentPRs.title")}</h2>

              <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
                {recentRuns.length === 0 ? (
                  <div className="px-6 py-12 text-center text-sm text-zinc-500">
                    {t("dashboard.recentPRs.noRuns")}
                    <div className="mt-3">
                      <a
                        href={installUrl}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-950 hover:underline"
                      >
                        {t("dashboard.installCta")}
                        <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-zinc-50 border-b border-zinc-200">
                        <th className="px-6 py-3 text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t("dashboard.recentPRs.colIdentifier")}</th>
                        <th className="px-6 py-3 text-[12px] font-medium text-zinc-500 uppercase tracking-wider">{t("dashboard.recentPRs.colFindings")}</th>
                        <th className="px-6 py-3 text-[12px] font-medium text-zinc-500 uppercase tracking-wider text-right">{t("dashboard.recentPRs.colStatus")}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {recentRuns.map((run) => (
                        <tr key={run.id} className="hover:bg-zinc-50 transition-colors">
                          <td className="px-6 py-4">
                            <Link to={`/runs/${run.id}`} className="flex flex-col hover:underline">
                              <span className="font-mono text-sm font-semibold text-zinc-950">PR-{run.pr_number}</span>
                              <span className="text-xs text-zinc-500 truncate max-w-[180px]">{run.project.github_repo_full_name}</span>
                            </Link>
                          </td>
                          <td className="px-6 py-4">
                            {run.status === "running" || run.status === "queued" ? (
                              <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-[16px] text-zinc-400 animate-pulse">sync</span>
                                <span className="font-mono text-[11px] text-zinc-500 italic">{t("dashboard.recentPRs.processing")}</span>
                              </div>
                            ) : (
                              <span className="font-mono text-[11px] text-zinc-500">
                                {new Date(run.created_at).toLocaleString()}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <RunStatusBadge status={run.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </section>

            {/* Health */}
            <section className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold tracking-tight text-zinc-950">{t("dashboard.health.title")}</h2>
                <a href={installUrl} className="p-1 text-zinc-400 hover:text-zinc-950 transition-colors">
                  <span className="material-symbols-outlined text-[18px]">add</span>
                </a>
              </div>

              <div className="bg-white border border-zinc-200 rounded-lg p-1">
                <div className="space-y-1">
                  {healthProjects.length === 0 ? (
                    <p className="px-3 py-6 text-center text-sm text-zinc-500">{t("dashboard.health.noProjects")}</p>
                  ) : (
                    healthProjects.map(({ project, lastRun }) => {
                      const { label, colorClass, pct, icon } = healthStatus(lastRun?.status);
                      return (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}/runs`}
                          className="flex items-center justify-between p-3 hover:bg-zinc-50 transition-all rounded group"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded border border-zinc-100 flex items-center justify-center bg-zinc-50 flex-shrink-0">
                              <span className="material-symbols-outlined text-zinc-400 text-sm">{icon}</span>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-zinc-950 truncate max-w-[110px]">
                                {project.github_repo_full_name.split("/")[1]}
                              </span>
                              <span className={`text-[10px] font-mono ${colorClass}`}>{label}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-mono text-zinc-400">{pct}%</span>
                            <div className="w-16 h-1 bg-zinc-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? "bg-emerald-500" : pct >= 70 ? "bg-zinc-400" : "bg-red-500"}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>

                {/* Mini terminal */}
                <div className="mt-4 p-4 bg-zinc-950 rounded-md">
                  <p className="text-[10px] font-mono text-zinc-500 mb-2 uppercase tracking-widest">{t("dashboard.health.shellLabel")}</p>
                  <div className="font-mono text-[12px] text-zinc-300 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-emerald-500">$</span>
                      <span>codeshield scan --target {latestProject}</span>
                    </div>
                    {totalRuns > 0 ? (
                      <>
                        <div className="text-zinc-500">{t("dashboard.health.shellDone", { count: totalRuns })}</div>
                        <div className="text-emerald-400">{t("dashboard.health.shellResult")}</div>
                      </>
                    ) : (
                      <div className="text-zinc-600 italic">{t("dashboard.health.shellIdle")}</div>
                    )}
                  </div>
                </div>
              </div>
            </section>

          </div>
        </main>
      )}

      {/* FAB — only when projects exist */}
      {projects !== undefined && projects.length > 0 && (
        <a
          href={installUrl}
          className="fixed bottom-8 right-8 w-12 h-12 bg-zinc-950 text-white rounded-full flex items-center justify-center shadow-lg hover:scale-105 transition-transform active:scale-95 z-50"
          title={t("dashboard.installCta")}
        >
          <span className="material-symbols-outlined">add</span>
        </a>
      )}
    </AppLayout>
  );
}

function StatCard({
  label,
  value,
  icon,
  sub,
  highlight,
}: {
  label: string;
  value: string | number;
  icon: string;
  sub: string;
  highlight?: "critical" | "normal";
}) {
  return (
    <div
      className={`bg-white border border-zinc-200 p-5 rounded-lg flex flex-col justify-between hover:border-zinc-400 transition-colors ${
        highlight === "critical" ? "border-l-4 border-l-red-500" : ""
      }`}
    >
      <div>
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-1">{label}</p>
        <h3 className={`font-mono text-3xl font-bold ${highlight === "critical" ? "text-red-600" : "text-zinc-950"}`}>
          {value}
        </h3>
      </div>
      <div className={`mt-4 flex items-center text-[10px] font-mono ${highlight === "critical" ? "text-red-500 font-semibold" : "text-zinc-400"}`}>
        <span className="material-symbols-outlined text-[14px] mr-1">{icon}</span>
        {sub}
      </div>
    </div>
  );
}

function RunStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "PASS", cls: "bg-emerald-50 text-emerald-700 border border-emerald-100" },
    failed: { label: "FAIL", cls: "bg-red-50 text-red-700 border border-red-100" },
    running: { label: "RUNNING", cls: "bg-blue-50 text-blue-700 border border-blue-100" },
    queued: { label: "QUEUED", cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" },
    cancelled: { label: "CANCELLED", cls: "bg-zinc-100 text-zinc-500 border border-zinc-200" },
  };
  const { label, cls } = map[status] ?? { label: status.toUpperCase(), cls: "bg-zinc-100 text-zinc-600 border border-zinc-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono font-medium ${cls}`}>
      {label}
    </span>
  );
}

function healthStatus(status?: string): { label: string; colorClass: string; pct: number; icon: string } {
  switch (status) {
    case "completed": return { label: "Healthy", colorClass: "text-emerald-600", pct: 98, icon: "terminal" };
    case "running":
    case "queued":   return { label: "Scanning...", colorClass: "text-blue-500", pct: 50, icon: "sync" };
    case "failed":   return { label: "Review Required", colorClass: "text-zinc-500", pct: 64, icon: "cloud" };
    default:         return { label: "No data yet", colorClass: "text-zinc-400", pct: 0, icon: "integration_instructions" };
  }
}

function LoadingSkeleton() {
  return (
    <main className="p-8 max-w-[1280px] w-full mx-auto space-y-8 animate-pulse">
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white border border-zinc-200 p-5 rounded-lg space-y-3">
            <div className="h-3 w-24 bg-zinc-100 rounded" />
            <div className="h-8 w-16 bg-zinc-100 rounded" />
            <div className="h-2 w-32 bg-zinc-100 rounded" />
          </div>
        ))}
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
          <div className="h-4 w-40 bg-zinc-100 rounded" />
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-10 bg-zinc-50 rounded" />
          ))}
        </div>
        <div className="bg-white border border-zinc-200 rounded-lg p-6 space-y-3">
          <div className="h-4 w-24 bg-zinc-100 rounded" />
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-zinc-50 rounded" />
          ))}
        </div>
      </div>
    </main>
  );
}

function InstallScreen({ installUrl }: { installUrl: string }) {
  const { t } = useTranslation();

  const steps = [
    { icon: "download", title: t("dashboard.install.step1Title"), desc: t("dashboard.install.step1Desc") },
    { icon: "merge_type", title: t("dashboard.install.step2Title"), desc: t("dashboard.install.step2Desc") },
    { icon: "auto_awesome", title: t("dashboard.install.step3Title"), desc: t("dashboard.install.step3Desc") },
  ];

  return (
    <main className="flex-1 flex flex-col items-center justify-center px-6 py-16 min-h-[calc(100vh-3.5rem)]">
      <div className="max-w-2xl w-full text-center space-y-8">

        <div className="flex justify-center">
          <div className="w-16 h-16 bg-zinc-950 rounded-2xl flex items-center justify-center shadow-lg">
            <span
              className="material-symbols-outlined text-white text-3xl"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              shield
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-3xl font-black tracking-tighter text-zinc-950">{t("dashboard.install.headline")}</h2>
          <p className="text-zinc-500 text-base leading-relaxed max-w-lg mx-auto">{t("dashboard.install.subtext")}</p>
        </div>

        <a
          href={installUrl}
          className="inline-flex items-center gap-2 bg-zinc-950 text-white text-sm font-semibold px-6 py-3 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
          {t("dashboard.install.cta")}
        </a>

        <div className="pt-8 space-y-4">
          <p className="text-xs font-mono text-zinc-400 uppercase tracking-widest">{t("dashboard.install.stepsTitle")}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
            {steps.map((step, i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-lg p-5 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-zinc-50 border border-zinc-200 rounded flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-zinc-500 text-[18px]">{step.icon}</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">0{i + 1}</span>
                </div>
                <p className="text-sm font-semibold text-zinc-950 tracking-tight">{step.title}</p>
                <p className="text-xs text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
