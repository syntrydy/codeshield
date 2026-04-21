import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { fetchProjects, updateProject, type Project, type ProjectUpdate } from "../lib/api";
import { AppLayout } from "../components/AppLayout";

const SPECIALISTS = ["security", "correctness", "performance", "style"] as const;
const THRESHOLDS = ["critical", "high", "medium", "low", "info"] as const;
const LOCALES = ["en", "fr"] as const;

export function SettingsPage() {
  const { t } = useTranslation();

  const { data: projects, isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  return (
    <AppLayout
      activePage="settings"
      breadcrumb={t("settings.breadcrumb")}
      hasProjects={(projects?.length ?? 0) > 0}
    >
      <main className="p-8 max-w-[960px] w-full mx-auto space-y-6">
        <h2 className="text-2xl font-black tracking-tighter text-zinc-950">{t("settings.title")}</h2>

        {isLoading ? (
          <SettingsSkeleton />
        ) : !projects || projects.length === 0 ? (
          <div className="bg-white border border-zinc-200 rounded-lg px-6 py-12 text-center text-sm text-zinc-500">
            {t("settings.noProjects")}
          </div>
        ) : (
          projects.map((project) => (
            <ProjectSettingsCard key={project.id} project={project} />
          ))
        )}
      </main>
    </AppLayout>
  );
}

function ProjectSettingsCard({ project }: { project: Project }) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [specialists, setSpecialists] = useState<string[]>(project.enabled_specialists);
  const [threshold, setThreshold] = useState(project.severity_threshold);
  const [locale, setLocale] = useState(project.review_output_locale);

  const { mutate, isPending, isSuccess, reset } = useMutation({
    mutationFn: (body: ProjectUpdate) => updateProject(project.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      setTimeout(reset, 2000);
    },
  });

  const isDirty =
    JSON.stringify([...specialists].sort()) !== JSON.stringify([...project.enabled_specialists].sort()) ||
    threshold !== project.severity_threshold ||
    locale !== project.review_output_locale;

  const toggleSpecialist = (s: string) => {
    setSpecialists((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]
    );
  };

  const save = () => {
    mutate({ enabled_specialists: specialists, severity_threshold: threshold, review_output_locale: locale });
  };

  const selectCls =
    "w-full bg-white border border-zinc-200 rounded-md px-3 py-2 text-sm text-zinc-950 focus:outline-none focus:border-zinc-400 transition-colors appearance-none cursor-pointer";

  return (
    <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">

      {/* Card header */}
      <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3">
        <div className="w-9 h-9 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-zinc-400 text-[20px]">code_blocks</span>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-950 tracking-tight">
            {project.github_repo_full_name.split("/")[1]}
          </p>
          <p className="text-xs text-zinc-400 font-mono">{project.github_repo_full_name}</p>
        </div>
      </div>

      {/* Fields */}
      <div className="px-6 py-6 space-y-6">

        {/* Specialists */}
        <div>
          <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-3">
            {t("settings.project.specialists")}
          </p>
          <div className="flex flex-wrap gap-2">
            {SPECIALISTS.map((s) => {
              const active = specialists.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleSpecialist(s)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    active
                      ? "bg-zinc-950 text-white border-zinc-950"
                      : "bg-white text-zinc-500 border-zinc-200 hover:border-zinc-400 hover:text-zinc-950"
                  }`}
                >
                  {active && (
                    <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                      check
                    </span>
                  )}
                  {t(`settings.specialists.${s}`)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Threshold + Locale */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">
              {t("settings.project.threshold")}
            </label>
            <div className="relative">
              <select
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className={selectCls}
              >
                {THRESHOLDS.map((v) => (
                  <option key={v} value={v}>{t(`settings.threshold.${v}`)}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-400 text-[16px]">
                expand_more
              </span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-500 uppercase tracking-wider block mb-2">
              {t("settings.project.locale")}
            </label>
            <div className="relative">
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className={selectCls}
              >
                {LOCALES.map((v) => (
                  <option key={v} value={v}>{t(`settings.locale.${v}`)}</option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-zinc-400 text-[16px]">
                expand_more
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-zinc-100 flex items-center justify-end gap-3">
        {isSuccess && (
          <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium">
            <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
            {t("settings.project.saved")}
          </span>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isPending}
          className="inline-flex items-center gap-2 bg-zinc-950 text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isPending && (
            <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
          )}
          {isPending ? t("settings.project.saving") : t("settings.project.save")}
        </button>
      </div>
    </div>
  );
}

function SettingsSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bg-white border border-zinc-200 rounded-lg p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-zinc-100 rounded-md" />
            <div className="space-y-1.5">
              <div className="h-3 w-32 bg-zinc-100 rounded" />
              <div className="h-2 w-48 bg-zinc-100 rounded" />
            </div>
          </div>
          <div className="h-2 w-24 bg-zinc-100 rounded" />
          <div className="flex gap-2">
            {[...Array(4)].map((_, j) => (
              <div key={j} className="h-7 w-20 bg-zinc-100 rounded-md" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-9 bg-zinc-100 rounded-md" />
            <div className="h-9 bg-zinc-100 rounded-md" />
          </div>
        </div>
      ))}
    </div>
  );
}
