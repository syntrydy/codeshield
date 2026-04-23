import { useState } from "react";
import { useQuery, useQueries, useInfiniteQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProjects, fetchRuns, PAGE_SIZE, type Project, type Run } from "../lib/api";
import { AppLayout } from "../components/AppLayout";
import { DeleteRunDialog } from "../components/DeleteRunDialog";

type RunWithProject = Run & { project: Project };

const STATUS_FILTERS = ["all", "queued", "running", "completed", "failed"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

const STATUS_BADGE: Record<string, { label: string; cls: string; dot?: string }> = {
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  failed:    { label: "Failed",    cls: "bg-red-50 text-red-700 border-red-100" },
  running:   { label: "Running",   cls: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-500 animate-pulse" },
  queued:    { label: "Queued",    cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-400 border-zinc-200" },
};

function duration(run: Run): string {
  if (!run.started_at || !run.completed_at) return "—";
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function RunsTable({ runs }: { runs: RunWithProject[] }) {
  const { t } = useTranslation();
  return (
    <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t("allRuns.colProject")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t("allRuns.colPR")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t("allRuns.colStatus")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden md:table-cell">{t("allRuns.colCommit")}</th>
            <th className="px-5 py-3 text-left text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">{t("allRuns.colDuration")}</th>
            <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider hidden lg:table-cell">{t("allRuns.colCost")}</th>
            <th className="px-5 py-3 text-right text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{t("allRuns.colTriggered")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {runs.map((run) => {
            const badge = STATUS_BADGE[run.status] ?? STATUS_BADGE.queued;
            const [, repo] = run.project.github_repo_full_name.split("/");
            return (
              <tr key={run.id} className="hover:bg-zinc-50 transition-colors group">
                <td className="px-5 py-3.5">
                  <Link to={`/runs?project=${run.project_id}`} className="flex items-center gap-2 group/repo">
                    <div className="w-6 h-6 bg-zinc-950 rounded flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-white text-[11px]">code_blocks</span>
                    </div>
                    <span className="text-xs font-semibold text-zinc-800 group-hover/repo:text-zinc-950 truncate max-w-[120px]">{repo}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <Link to={`/runs/${run.id}`} className="flex items-center gap-1.5 hover:underline">
                    <span className="material-symbols-outlined text-zinc-400 text-[13px]">merge_type</span>
                    <span className="font-mono text-xs font-semibold text-zinc-950">#{run.pr_number}</span>
                  </Link>
                </td>
                <td className="px-5 py-3.5">
                  <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border ${badge.cls}`}>
                    {badge.dot && <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />}
                    {badge.label}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden md:table-cell">
                  <span className="font-mono text-[11px] text-zinc-400 bg-zinc-50 border border-zinc-100 rounded px-1.5 py-0.5">
                    {run.pr_head_sha.slice(0, 7)}
                  </span>
                </td>
                <td className="px-5 py-3.5 hidden lg:table-cell">
                  <span className="font-mono text-xs text-zinc-500">{duration(run)}</span>
                </td>
                <td className="px-5 py-3.5 text-right hidden lg:table-cell">
                  <span className="font-mono text-xs text-zinc-500">${run.total_cost_usd.toFixed(4)}</span>
                </td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span className="text-xs text-zinc-400">{relativeTime(run.created_at)}</span>
                    <Link
                      to={`/runs/${run.id}`}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-xs font-medium text-zinc-950 hover:underline"
                    >
                      View <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                    </Link>
                    <DeleteRunDialog
                      runId={run.id}
                      prNumber={run.pr_number}
                      trigger={
                        <button
                          type="button"
                          aria-label={t("runDelete.trigger")}
                          title={t("runDelete.trigger")}
                          className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center justify-center w-6 h-6 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      }
                    />
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AllRunsPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const projectFilter = searchParams.get("project") ?? "all";
  const setProjectFilter = (value: string) => {
    setSearchParams(value === "all" ? {} : { project: value }, { replace: true });
  };

  const { data: projects } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const projectList = projects ?? [];

  // ── Single-project view: infinite scroll ─────────────────────────────────────
  const selectedProject = projectList.find((p) => p.id === projectFilter) ?? null;

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["runs-infinite", projectFilter],
    queryFn: ({ pageParam = 0 }) => fetchRuns(projectFilter, { offset: pageParam as number }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.flat().length : undefined,
    enabled: projectFilter !== "all" && !!projects,
  });

  // ── All-projects view: capped at PAGE_SIZE per project ───────────────────────
  const allProjectsQueries = useQueries({
    queries: projectList.map((p) => ({
      queryKey: ["runs", p.id] as const,
      queryFn: () => fetchRuns(p.id, { limit: PAGE_SIZE }),
      enabled: projectFilter === "all" && !!projects,
    })),
  });

  const isLoading =
    !projects ||
    (projectFilter === "all"
      ? allProjectsQueries.some((q) => q.isLoading)
      : infiniteQuery.isLoading);

  const allRuns: RunWithProject[] =
    projectFilter !== "all" && selectedProject
      ? (infiniteQuery.data?.pages.flat() ?? []).map((r) => ({ ...r, project: selectedProject }))
      : allProjectsQueries
          .flatMap((q, i) => (q.data ?? []).map((r) => ({ ...r, project: projectList[i] })))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const filtered = allRuns.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const counts = STATUS_FILTERS.slice(1).reduce<Record<string, number>>((acc, s) => {
    acc[s] = allRuns.filter((r) => r.status === s).length;
    return acc;
  }, {});

  const canLoadMore = projectFilter !== "all" && infiniteQuery.hasNextPage;

  return (
    <AppLayout activePage="runs" breadcrumb={t("allRuns.breadcrumb")} hasProjects={projectList.length > 0}>
      <main className="p-8 w-full space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-zinc-950">{t("allRuns.title")}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{t("allRuns.subtitle")}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {(["running", "queued"] as const).map((s) => counts[s] > 0 && (
              <span key={s} className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${STATUS_BADGE[s].cls}`}>
                {STATUS_BADGE[s].dot && <span className={`w-1.5 h-1.5 rounded-full ${STATUS_BADGE[s].dot}`} />}
                {counts[s]} {s}
              </span>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center bg-zinc-100 rounded-lg p-0.5 gap-0.5">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  statusFilter === s ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-700"
                }`}
              >
                {s === "all" ? t("allRuns.filterAll") : t(`status.${s}`)}
                {s !== "all" && counts[s] > 0 && <span className="ml-1.5 text-zinc-400">{counts[s]}</span>}
              </button>
            ))}
          </div>

          {projectList.length > 1 && (
            <select
              value={projectFilter}
              onChange={(e) => setProjectFilter(e.target.value)}
              className="text-xs border border-zinc-200 rounded-lg px-3 py-2 bg-white text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-300"
            >
              <option value="all">{t("allRuns.allProjects")}</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>{p.github_repo_full_name}</option>
              ))}
            </select>
          )}
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="bg-white border border-zinc-200 rounded-xl overflow-hidden animate-pulse">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-zinc-100 last:border-0">
                <div className="h-3 w-28 bg-zinc-100 rounded" />
                <div className="h-3 w-12 bg-zinc-100 rounded" />
                <div className="h-5 w-20 bg-zinc-100 rounded-full" />
                <div className="ml-auto h-3 w-16 bg-zinc-100 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Table */}
        {!isLoading && filtered.length > 0 && <RunsTable runs={filtered} />}

        {/* Load more (single-project view only) */}
        {canLoadMore && (
          <div className="flex justify-center">
            <button
              onClick={() => void infiniteQuery.fetchNextPage()}
              disabled={infiniteQuery.isFetchingNextPage}
              className="px-6 py-2 text-xs font-medium text-zinc-700 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors disabled:opacity-40"
            >
              {infiniteQuery.isFetchingNextPage ? t("common.loading") : t("allRuns.loadMore")}
            </button>
          </div>
        )}

        {/* Empty states */}
        {!isLoading && allRuns.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-14 h-14 bg-zinc-100 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-zinc-400 text-2xl">history</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">{t("allRuns.emptyTitle")}</p>
              <p className="text-xs text-zinc-500 mt-1">{t("allRuns.emptySubtext")}</p>
            </div>
          </div>
        )}

        {!isLoading && allRuns.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center space-y-2">
            <span className="material-symbols-outlined text-zinc-300 text-3xl">filter_list</span>
            <p className="text-sm text-zinc-500">{t("allRuns.noMatch")}</p>
            <button
              onClick={() => { setStatusFilter("all"); setProjectFilter("all"); }}
              className="text-xs font-medium text-zinc-950 hover:underline"
            >
              {t("allRuns.clearFilters")}
            </button>
          </div>
        )}

      </main>
    </AppLayout>
  );
}
