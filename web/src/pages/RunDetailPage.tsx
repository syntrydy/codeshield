import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchRun } from "../lib/api";
import { useRunEvents } from "../hooks/useRunEvents";

export function RunDetailPage() {
  const { runId } = useParams<{ runId: string }>();
  const { t } = useTranslation();

  const { data: run, isLoading, isError } = useQuery({
    queryKey: ["runs", runId],
    queryFn: () => fetchRun(runId!),
    enabled: !!runId,
  });

  const liveEvents = useRunEvents(runId, run?.events);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-white/40 text-sm">
        {t("common.loading")}
      </div>
    );
  }

  if (isError || !run) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center text-red-400 text-sm">
        {t("common.error")}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
      <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#0a0a0a]/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-3">
          <Link
            to={`/projects/${run.project_id}/runs`}
            className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
            {t("common.back")}
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-sm font-semibold text-white">PR #{run.pr_number}</span>
          <div className="ml-auto flex items-center gap-3 text-xs text-white/40">
            <span className="font-mono">{run.pr_head_sha.slice(0, 7)}</span>
            <span className="font-mono" title={`${run.total_input_tokens.toLocaleString()} ${t("runDetail.tokensIn")} · ${run.total_output_tokens.toLocaleString()} ${t("runDetail.tokensOut")}`}>
              {(run.total_input_tokens / 1000).toFixed(1)}k {t("runDetail.tokensIn")} · {(run.total_output_tokens / 1000).toFixed(1)}k {t("runDetail.tokensOut")}
            </span>
            <span className="text-white/20">·</span>
            <span>${run.total_cost_usd.toFixed(4)}</span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">

        {/* Findings */}
        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
            {t("runDetail.findings")} {run.findings.length > 0 && <span className="text-white/30 normal-case tracking-normal font-normal">· {run.findings.length}</span>}
          </h2>

          {run.findings.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-10 text-center text-sm text-white/40">
              {t("runDetail.noFindings")}
            </div>
          ) : (
            <div className="space-y-3">
              {run.findings.map((f) => (
                <div key={f.id} className="rounded-xl border border-white/[0.06] bg-[#111] p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <p className="font-medium text-white text-sm">{f.title}</p>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${severityStyle(f.severity)}`}>
                        {t(`severity.${f.severity}`, { defaultValue: f.severity })}
                      </span>
                      <span className="text-xs text-white/30">{f.specialist}</span>
                    </div>
                  </div>

                  {f.file_path && (
                    <p className="text-xs font-mono text-white/40 bg-white/[0.03] border border-white/[0.06] rounded px-2.5 py-1.5 w-fit">
                      {f.file_path}
                      {f.line_start != null && `:${f.line_start}`}
                      {f.line_end != null && f.line_end !== f.line_start && `–${f.line_end}`}
                    </p>
                  )}

                  <p className="text-sm text-white/60 leading-relaxed">{f.explanation}</p>

                  {f.suggested_fix && (
                    <pre className="rounded-lg bg-[#0d0d0d] border border-white/[0.06] px-4 py-3 text-xs text-white/60 overflow-x-auto leading-relaxed">
                      {f.suggested_fix}
                    </pre>
                  )}

                  <p className="text-xs text-white/30">
                    {t("runDetail.confidence")}: {f.confidence}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Events */}
        <section>
          <h2 className="text-sm font-semibold text-white/60 uppercase tracking-widest mb-4">
            {t("runDetail.events")}
          </h2>

          {liveEvents.length === 0 ? (
            <div className="rounded-xl border border-white/[0.06] bg-[#111] px-6 py-10 text-center text-sm text-white/40">
              {t("runDetail.noEvents")}
            </div>
          ) : (
            <div className="rounded-xl border border-white/[0.06] overflow-hidden">
              {liveEvents.map((ev, i) => (
                <div
                  key={ev.id}
                  className={`flex items-start gap-4 px-5 py-3.5 bg-[#0d0d0d] hover:bg-[#111] transition-colors ${i > 0 ? "border-t border-white/[0.04]" : ""}`}
                >
                  <span className="font-mono text-xs text-white/30 whitespace-nowrap pt-0.5 w-20 flex-shrink-0">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-white/70">{ev.event_type}</p>
                    {Object.keys(ev.payload).length > 0 && (
                      <pre className="mt-1 text-xs text-white/30 overflow-x-auto leading-relaxed">
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

function severityStyle(severity: string): string {
  switch (severity) {
    case "critical": return "text-red-400 border-red-500/30 bg-red-500/10";
    case "high": return "text-orange-400 border-orange-500/30 bg-orange-500/10";
    case "medium": return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
    case "low": return "text-blue-400 border-blue-500/30 bg-blue-500/10";
    default: return "text-white/40 border-white/10 bg-white/5";
  }
}
