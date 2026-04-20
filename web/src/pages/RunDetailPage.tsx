import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchRun } from "../lib/api";

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { t } = useTranslation();

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        {t("common.loading")}
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="min-h-screen flex items-center justify-center text-destructive">
        {t("common.error")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            to={`/projects/${run.project_id}/runs`}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <span className="font-bold text-lg">
            {t("runDetail.title")} — PR #{run.pr_number}
          </span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("runDetail.findings")}</h2>
          {run.findings.length === 0 ? (
            <p className="text-muted-foreground">{t("runDetail.noFindings")}</p>
          ) : (
            <div className="space-y-3">
              {run.findings.map((f) => (
                <div key={f.id} className="rounded-lg border p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{f.title}</p>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground capitalize">
                      {t(`severity.${f.severity}`, { defaultValue: f.severity })}
                    </span>
                  </div>
                  {f.file_path && (
                    <p className="text-xs text-muted-foreground font-mono">
                      {f.file_path}
                      {f.line_start != null && `:${f.line_start}`}
                      {f.line_end != null && f.line_end !== f.line_start && `–${f.line_end}`}
                    </p>
                  )}
                  <p className="text-sm">{f.explanation}</p>
                  {f.suggested_fix && (
                    <pre className="mt-2 rounded bg-muted p-3 text-xs overflow-x-auto">
                      {f.suggested_fix}
                    </pre>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {t("runDetail.specialist")}: {f.specialist} · {t("runDetail.confidence")}: {f.confidence}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">{t("runDetail.events")}</h2>
          {run.events.length === 0 ? (
            <p className="text-muted-foreground">{t("runDetail.noEvents")}</p>
          ) : (
            <div className="rounded-lg border divide-y">
              {run.events.map((ev) => (
                <div key={ev.id} className="px-4 py-3 flex items-start gap-4">
                  <span className="font-mono text-xs text-muted-foreground whitespace-nowrap pt-0.5">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{ev.event_type}</p>
                    {Object.keys(ev.payload).length > 0 && (
                      <pre className="mt-1 text-xs text-muted-foreground overflow-x-auto">
                        {JSON.stringify(ev.payload, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
