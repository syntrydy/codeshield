import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { fetchProjects } from "../lib/api";
import { useAuth } from "../hooks/useAuth";

export function DashboardPage() {
  const { t } = useTranslation();
  const { signOut } = useAuth();

  const { data: projects, isLoading, isError } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <span className="font-bold text-lg">{t("app.name")}</span>
          <button
            onClick={() => void signOut()}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.signOut")}
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">{t("dashboard.title")}</h1>
          <a
            href={`https://github.com/apps/${import.meta.env.VITE_GITHUB_APP_SLUG}/installations/new`}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            {t("dashboard.installCta")}
          </a>
        </div>

        {isLoading && <p className="text-muted-foreground">{t("common.loading")}</p>}
        {isError && <p className="text-destructive">{t("common.error")}</p>}

        {projects && projects.length === 0 && (
          <p className="text-muted-foreground">{t("dashboard.empty")}</p>
        )}

        <div className="grid gap-4">
          {projects?.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}/runs`}
              className="block rounded-lg border bg-card p-4 hover:bg-accent transition-colors"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium">{project.github_repo_full_name}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {t("dashboard.defaultBranch")}: {project.default_branch}
                  </p>
                </div>
                <div className="text-right text-sm text-muted-foreground space-y-1">
                  <p>
                    {t("dashboard.threshold")}: {project.severity_threshold}
                  </p>
                  <p>
                    {t("dashboard.specialists")}: {project.enabled_specialists.join(", ")}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
