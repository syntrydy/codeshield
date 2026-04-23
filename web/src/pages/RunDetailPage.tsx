import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { fetchRun, type RunDetail, type Finding, type RunEvent } from "../lib/api";
import { useRunEvents } from "../hooks/useRunEvents";
import { AppLayout } from "../components/AppLayout";

const STATUS_BADGE: Record<string, { label: string; cls: string; dot?: string }> = {
  completed: { label: "Completed", cls: "bg-emerald-50 text-emerald-700 border-emerald-100" },
  failed:    { label: "Failed",    cls: "bg-red-50 text-red-700 border-red-100" },
  running:   { label: "Running",   cls: "bg-blue-50 text-blue-700 border-blue-100", dot: "bg-blue-500 animate-pulse" },
  queued:    { label: "Queued",    cls: "bg-zinc-100 text-zinc-600 border-zinc-200" },
  cancelled: { label: "Cancelled", cls: "bg-zinc-100 text-zinc-400 border-zinc-200" },
};

const SEVERITY_STYLE: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-100",
  high:     "bg-orange-50 text-orange-700 border-orange-100",
  medium:   "bg-amber-50 text-amber-700 border-amber-100",
  low:      "bg-blue-50 text-blue-700 border-blue-100",
  info:     "bg-zinc-100 text-zinc-500 border-zinc-200",
};

const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];

function duration(run: RunDetail): string {
  if (!run.started_at || !run.completed_at) return "—";
  const ms = new Date(run.completed_at).getTime() - new Date(run.started_at).getTime();
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

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
      <AppLayout activePage="runs" breadcrumb={t("runDetail.breadcrumb")} hasProjects>
        <main className="p-8 w-full space-y-6 animate-pulse">
          <div className="h-20 bg-white border border-zinc-200 rounded-lg" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-32 bg-white border border-zinc-200 rounded-lg" />)}
            </div>
            <div className="h-64 bg-white border border-zinc-200 rounded-lg" />
          </div>
        </main>
      </AppLayout>
    );
  }

  if (isError || !run) {
    return (
      <AppLayout activePage="runs" breadcrumb={t("runDetail.breadcrumb")} hasProjects>
        <main className="p-8 w-full flex items-center justify-center py-24 text-sm text-zinc-500">
          {t("common.error")}
        </main>
      </AppLayout>
    );
  }

  const badge = STATUS_BADGE[run.status] ?? STATUS_BADGE.queued;
  const cost = Number(run.total_cost_usd) || 0;
  const sorted = [...run.findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
  );

  return (
    <AppLayout
      activePage="runs"
      breadcrumb={`${t("runDetail.breadcrumb")} / PR #${run.pr_number}`}
      hasProjects
    >
      <main className="p-8 w-full space-y-6">

        {/* Back link */}
        <div>
          <Link
            to={`/runs?project=${run.project_id}`}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-950 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">arrow_back</span>
            {t("common.back")}
          </Link>
        </div>

        {/* Meta strip */}
        <div className="bg-white border border-zinc-200 rounded-lg px-6 py-4 flex items-center gap-6 flex-wrap">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-mono font-semibold border ${badge.cls}`}
              aria-label={`${t("runDetail.status")}: ${badge.label}`}
              role="status"
            >
              {badge.dot && <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} aria-hidden="true" />}
              {badge.label}
            </span>
          </div>

          <MetaChip label="PR" value={`#${run.pr_number}`} />
          <MetaChip label={t("allRuns.colCommit")} value={run.pr_head_sha.slice(0, 7)} mono />
          <MetaChip label={t("allRuns.colCost")} value={`$${cost.toFixed(4)}`} mono />
          <MetaChip
            label={t("runDetail.tokensIn")}
            value={`${(run.total_input_tokens / 1000).toFixed(1)}k`}
            mono
          />
          <MetaChip
            label={t("runDetail.tokensOut")}
            value={`${(run.total_output_tokens / 1000).toFixed(1)}k`}
            mono
          />
          <MetaChip label={t("allRuns.colDuration")} value={duration(run)} mono />
          {run.created_at && (
            <MetaChip
              label={t("allRuns.colTriggered")}
              value={new Date(run.created_at).toLocaleString()}
            />
          )}
        </div>

        {/* Content grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Findings */}
          <section className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {t("runDetail.findings")}
              {sorted.length > 0 && (
                <span className="ml-2 font-normal normal-case tracking-normal text-zinc-400">{sorted.length}</span>
              )}
            </h2>

            {sorted.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-6 py-12 text-center text-sm text-zinc-500">
                {t("runDetail.noFindings")}
              </div>
            ) : (
              <div className="space-y-3">
                {sorted.map((f) => <FindingCard key={f.id} finding={f} t={t} />)}
              </div>
            )}
          </section>

          {/* Events */}
          <section className="space-y-4">
            <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
              {t("runDetail.events")}
            </h2>

            {liveEvents.length === 0 ? (
              <div className="bg-white border border-zinc-200 rounded-lg px-6 py-12 text-center text-sm text-zinc-500">
                {t("runDetail.noEvents")}
              </div>
            ) : (
              <div className="bg-white border border-zinc-200 rounded-lg px-5 py-4">
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-zinc-100" />
                  <div className="space-y-4">
                    {liveEvents.map((ev, i) => <EventRow key={ev.id} ev={ev} i={i} total={liveEvents.length} />)}
                  </div>
                </div>
              </div>
            )}
          </section>

        </div>
      </main>
    </AppLayout>
  );
}

function MetaChip({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider">{label}</span>
      <span className={`text-sm font-semibold text-zinc-950 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function FindingCard({ finding: f, t }: { finding: Finding; t: TFunction }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_STYLE[f.severity] ?? SEVERITY_STYLE.info;
  const bodyId = `finding-body-${f.id}`;
  const hasBody = Boolean(f.file_path || f.explanation || f.suggested_fix || f.confidence);

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={bodyId}
        disabled={!hasBody}
        className="w-full flex items-start justify-between gap-4 p-5 text-left hover:bg-zinc-50 transition-colors disabled:cursor-default disabled:hover:bg-transparent"
      >
        <div className="flex items-start gap-2 min-w-0">
          {hasBody && (
            <span
              className={`material-symbols-outlined text-[18px] text-zinc-400 mt-0.5 transition-transform ${open ? "rotate-90" : ""}`}
              aria-hidden="true"
            >
              chevron_right
            </span>
          )}
          <p className="text-sm font-semibold text-zinc-950 leading-snug">{f.title}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border ${sev}`}
            aria-label={`${t("runDetail.severity")}: ${t(`severity.${f.severity}`, { defaultValue: f.severity })}`}
          >
            {t(`severity.${f.severity}`, { defaultValue: f.severity })}
          </span>
          <span className="text-[11px] font-mono text-zinc-400 bg-zinc-50 border border-zinc-100 rounded px-2 py-0.5">
            {f.specialist}
          </span>
        </div>
      </button>

      {open && hasBody && (
        <div id={bodyId} className="px-5 pb-5 pt-0 space-y-3 border-t border-zinc-100">
          {f.file_path && (
            <p className="text-xs font-mono text-zinc-500 bg-zinc-50 border border-zinc-100 rounded px-2.5 py-1.5 w-fit mt-3">
              {f.file_path}
              {f.line_start != null && `:${f.line_start}`}
              {f.line_end != null && f.line_end !== f.line_start && `–${f.line_end}`}
            </p>
          )}

          {f.explanation && (
            <p className="text-sm text-zinc-600 leading-relaxed">{f.explanation}</p>
          )}

          {f.suggested_fix && (
            <pre className="rounded-lg bg-zinc-50 border border-zinc-100 px-4 py-3 text-xs text-zinc-600 overflow-x-auto leading-relaxed">
              {f.suggested_fix}
            </pre>
          )}

          {f.confidence && (
            <p className="text-xs text-zinc-400">
              {t("runDetail.confidence")}: <span className="font-medium text-zinc-500">{f.confidence}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function eventDotStyle(eventType: string): string {
  if (eventType.includes("failed") || eventType.includes("error")) return "bg-red-400 ring-red-100";
  if (eventType.includes("completed")) return "bg-emerald-400 ring-emerald-100";
  if (eventType.includes("started") || eventType.includes("running")) return "bg-blue-400 ring-blue-100";
  return "bg-zinc-300 ring-zinc-100";
}

function EventRow({ ev, i, total }: { ev: RunEvent; i: number; total: number }) {
  const isLast = i === total - 1;
  const dot = eventDotStyle(ev.event_type);
  return (
    <div className="relative flex gap-4 pl-1">
      {/* Dot */}
      <div className={`relative z-10 flex-shrink-0 w-3.5 h-3.5 mt-0.5 rounded-full ring-2 ${dot}`} />

      {/* Content */}
      <div className={`flex-1 min-w-0 ${!isLast ? "pb-4" : ""}`}>
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <p className="text-xs font-semibold text-zinc-800">{ev.event_type}</p>
          <span className="font-mono text-[10px] text-zinc-400 whitespace-nowrap flex-shrink-0">
            {new Date(ev.created_at).toLocaleTimeString()}
          </span>
        </div>
        {Object.keys(ev.payload).length > 0 && (
          <pre className="mt-1 text-[10px] text-zinc-400 bg-zinc-50 border border-zinc-100 rounded px-2.5 py-2 overflow-x-auto leading-relaxed">
            {JSON.stringify(ev.payload, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
