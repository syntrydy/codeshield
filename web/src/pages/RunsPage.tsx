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
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/dashboard" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← {t("common.back")}
          </Link>
          <span className="font-bold text-lg">{project?.github_repo_full_name ?? "…"}</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-semibold">{t("runs.title")}</h1>

        {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
        {isError && <p className="text-destructive">{t("common.error")}</p>}

        {runs && runs.length === 0 && (
          <p className="text-muted-foreground">{t("runs.empty")}</p>
        )}

        <div className="rounded-lg border overflow-hidden">
          {runs && runs.length > 0 && (
            <table className="w-full text-sm">
              <thead className="bg-muted text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 text-left">{t("runs.pr")}</th>
                  <th className="px-4 py-2 text-left">{t("runs.status")}</th>
                  <th className="px-4 py-2 text-left">{t("runs.created")}</th>
                  <th className="px-4 py-2 text-right">{t("runs.cost")}</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run) => (
                  <tr key={run.id} className="border-t hover:bg-accent transition-colors">
                    <td className="px-4 py-2">
                      <Link to={`/runs/${run.id}`} className="font-medium hover:underline">
                        #{run.pr_number}
                      </Link>
                    </td>
                    <td className="px-4 py-2">
                      <span className="capitalize">{t(`status.${run.status}`, { defaultValue: run.status })}</span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-right text-muted-foreground">
                      ${run.total_cost_usd.toFixed(4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}
