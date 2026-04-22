import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateProject, type Project, type ProjectUpdate } from "../lib/api";

const SPECIALISTS = ["security", "correctness", "performance", "style"] as const;
const THRESHOLDS = ["critical", "high", "medium", "low", "info"] as const;
const LOCALES = ["en", "fr"] as const;

type Props = {
  project: Project | null;
  onClose: () => void;
};

export function ProjectEditModal({ project, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [specialists, setSpecialists] = useState<string[]>([]);
  const [threshold, setThreshold] = useState("medium");
  const [locale, setLocale] = useState("en");

  useEffect(() => {
    if (project) {
      setSpecialists(project.enabled_specialists);
      setThreshold(project.severity_threshold);
      setLocale(project.review_output_locale);
    }
  }, [project]);

  const { mutate, isPending } = useMutation({
    mutationFn: (body: ProjectUpdate) => updateProject(project!.id, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    },
  });

  useEffect(() => {
    if (!project) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [project, onClose]);

  if (!project) return null;

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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center gap-3">
          <div className="w-9 h-9 bg-zinc-50 border border-zinc-200 rounded-md flex items-center justify-center flex-shrink-0">
            <span className="material-symbols-outlined text-zinc-400 text-[20px]">code_blocks</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-950 tracking-tight truncate">
              {project.github_repo_full_name.split("/")[1]}
            </p>
            <p className="text-xs text-zinc-400 font-mono truncate">{project.github_repo_full_name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Body */}
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
                      <span
                        className="material-symbols-outlined text-[14px]"
                        style={{ fontVariationSettings: "'FILL' 1" }}
                      >
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
                <select value={threshold} onChange={(e) => setThreshold(e.target.value)} className={selectCls}>
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
                <select value={locale} onChange={(e) => setLocale(e.target.value)} className={selectCls}>
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
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-semibold text-zinc-500 hover:text-zinc-950 transition-colors px-4 py-2"
          >
            {t("common.back")}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="inline-flex items-center gap-2 bg-zinc-950 text-white text-xs font-semibold px-4 py-2 rounded-md hover:bg-zinc-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending && (
              <span className="material-symbols-outlined text-[14px] animate-spin">refresh</span>
            )}
            {isPending ? t("settings.project.saving") : t("settings.project.save")}
          </button>
        </div>
      </div>
    </div>
  );
}
