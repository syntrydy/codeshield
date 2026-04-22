import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProjects, type Project } from "../lib/api";
import { AppLayout } from "../components/AppLayout";
import { ProjectEditModal } from "../components/ProjectEditModal";

const INSTALL_URL = `https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG}/installations/new`;

const SPECIALIST_ICONS: Record<string, string> = {
  security: "shield",
  correctness: "check_circle",
  performance: "speed",
  style: "format_paint",
};

const THRESHOLD_COLORS: Record<string, string> = {
  critical: "bg-red-50 text-red-700 border-red-100",
  high: "bg-orange-50 text-orange-700 border-orange-100",
  medium: "bg-yellow-50 text-yellow-700 border-yellow-100",
  low: "bg-zinc-50 text-zinc-600 border-zinc-200",
  info: "bg-blue-50 text-blue-600 border-blue-100",
};

export function ProjectsPage() {
  const { t } = useTranslation();
  const [editProject, setEditProject] = useState<Project | null>(null);

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  return (
    <AppLayout
      activePage="projects"
      breadcrumb={t("projects.breadcrumb")}
      hasProjects={(projects?.length ?? 0) > 0}
    >
      <main className="p-8 w-full space-y-6">

        {/* Page header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black tracking-tighter text-zinc-950">{t("projects.title")}</h1>
            <p className="text-sm text-zinc-500 mt-0.5">{t("projects.subtitle")}</p>
          </div>
          <a
            href={INSTALL_URL}
            className="inline-flex items-center gap-2 bg-zinc-950 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            {t("projects.addRepo")}
          </a>
        </div>

        {/* Loading skeleton */}
        {isLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white border border-zinc-200 rounded-xl p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-lg" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-32 bg-zinc-100 rounded" />
                    <div className="h-3 w-20 bg-zinc-100 rounded" />
                  </div>
                </div>
                <div className="flex gap-2">
                  {[1, 2, 3].map((j) => <div key={j} className="h-6 w-20 bg-zinc-100 rounded-full" />)}
                </div>
                <div className="h-px bg-zinc-100" />
                <div className="flex justify-between">
                  <div className="h-3 w-24 bg-zinc-100 rounded" />
                  <div className="h-3 w-16 bg-zinc-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="border border-red-200 bg-red-50 px-5 py-3 rounded-lg text-sm text-red-600">
            {t("common.error")}
          </div>
        )}

        {/* Project grid */}
        {projects && projects.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {projects.map((project) => (
              <ProjectCard key={project.id} project={project} onEdit={setEditProject} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {projects && projects.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center space-y-4">
            <div className="w-14 h-14 bg-zinc-100 rounded-xl flex items-center justify-center">
              <span className="material-symbols-outlined text-zinc-400 text-2xl">folder_open</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-zinc-950">{t("projects.emptyTitle")}</p>
              <p className="text-xs text-zinc-500 mt-1">{t("projects.emptySubtext")}</p>
            </div>
            <a
              href={INSTALL_URL}
              className="inline-flex items-center gap-2 bg-zinc-950 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              {t("dashboard.install.cta")}
            </a>
          </div>
        )}

      </main>

      <ProjectEditModal project={editProject} onClose={() => setEditProject(null)} />
    </AppLayout>
  );
}

function ProjectCard({ project, onEdit }: { project: Project; onEdit: (p: Project) => void }) {
  const { t } = useTranslation();
  const [owner, repo] = project.github_repo_full_name.split("/");

  return (
    <div className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col gap-5 hover:border-zinc-300 hover:shadow-sm transition-all">

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 bg-zinc-950 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-white text-[18px]">code_blocks</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-mono text-zinc-400 truncate">{owner}</p>
          <h3 className="text-sm font-bold text-zinc-950 tracking-tight truncate">{repo}</h3>
        </div>
        <button
          type="button"
          onClick={() => onEdit(project)}
          className="text-zinc-300 hover:text-zinc-600 transition-colors flex-shrink-0"
          title={t("settings.title")}
        >
          <span className="material-symbols-outlined text-[18px]">settings</span>
        </button>
      </div>

      {/* Branch + threshold */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-full text-[11px] font-mono text-zinc-600">
          <span className="material-symbols-outlined text-[12px]">call_split</span>
          {project.default_branch}
        </span>
        <span
          className={`inline-flex items-center px-2 py-1 border rounded-full text-[11px] font-mono ${THRESHOLD_COLORS[project.severity_threshold] ?? THRESHOLD_COLORS.low}`}
          aria-label={`${t("settings.project.threshold")}: ${t(`settings.threshold.${project.severity_threshold}`)}`}
        >
          {t(`settings.threshold.${project.severity_threshold}`)}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-zinc-50 border border-zinc-200 rounded-full text-[11px] font-mono text-zinc-600">
          <span className="material-symbols-outlined text-[12px]">language</span>
          {project.review_output_locale.toUpperCase()}
        </span>
      </div>

      {/* Specialists */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">{t("projects.specialists")}</p>
        <div className="flex flex-wrap gap-2">
          {["security", "correctness", "performance", "style"].map((s) => {
            const active = project.enabled_specialists.includes(s);
            return (
              <span
                key={s}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors ${
                  active
                    ? "bg-zinc-950 text-white border-zinc-950"
                    : "bg-zinc-50 text-zinc-400 border-zinc-100"
                }`}
              >
                <span className="material-symbols-outlined text-[12px]"
                  style={active ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {SPECIALIST_ICONS[s]}
                </span>
                {t(`settings.specialists.${s}`)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div className="pt-1 border-t border-zinc-100 flex items-center justify-between">
        <span className="text-[11px] font-mono text-zinc-400">
          {new Date(project.created_at).toLocaleDateString()}
        </span>
        <Link
          to={`/runs?project=${project.id}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-950 hover:text-zinc-600 transition-colors"
        >
          {t("projects.viewRuns")}
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </Link>
      </div>

    </div>
  );
}
