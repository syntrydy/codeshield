import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProject, fetchRuns } from "../lib/api";

export function RunsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { t } = useTranslation();

  const { data: project } = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => fetchProject(projectId!),
    enabled: !!projectId,
  });

  const { data: runs, isLoading, isError } = useQuery({
    queryKey: ["runs", projectId],
    queryFn: () => fetchRuns(projectId!),
    enabled: !!projectId,
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link to="/dashboard" className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {t("common.back")}
          </Link>
          <span className="text-white/20">/</span>
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <span className="font-semibold text-white text-sm">{project?.github_repo_full_name ?? "…"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold text-white">{t("runs.title")}</h1>
            <p className="text-sm text-white/40 mt-0.5">Review runs triggered by pull requests</p>
          </div>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 rounded-xl border border-white/[0.06] bg-[#111] animate-pulse" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-400">
            {t("common.error")}
          </div>
        )}

        {runs && runs.length === 0 && (
          <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-16 text-center">
            <p className="text-sm text-white/40">{t("runs.empty")}</p>
          </div>
        )}

        {runs && runs.length > 0 && (
          <div className="rounded-xl border border-white/[0.06] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.06] bg-[#111]">
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">{t("runs.pr")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">{t("runs.status")}</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-white/40">{t("runs.created")}</th>
                  <th className="px-5 py-3 text-right text-xs font-medium text-white/40">{t("runs.cost")}</th>
                </tr>
              </thead>
              <tbody className="bg-[#0d0d0d]">
                {runs.map((run, i) => (
                  <tr
                    key={run.id}
                    className={`hover:bg-[#111] transition-colors ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <Link to={`/runs/${run.id}`} className="font-medium text-white hover:text-white/70 transition-colors">
                        #{run.pr_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={run.status} label={t(`status.${run.status}`, { defaultValue: run.status })} />
                    </td>
                    <td className="px-5 py-3.5 text-white/40 text-xs">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right text-white/40 text-xs font-mono">
                      ${run.total_cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ status, label }: { status: string; label: string }) {
  const styles: Record<string, string> = {
    completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    running: "text-blue-400 bg-blue-500/10 border-blue-500/20",
    queued: "text-white/50 bg-white/5 border-white/10",
    failed: "text-red-400 bg-red-500/10 border-red-500/20",
    cancelled: "text-white/30 bg-white/5 border-white/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-xs ${styles[status] ?? styles.queued}`}>
      {status === "running" && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />}
      {label}
    </span>
  );
}
