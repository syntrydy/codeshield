import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuth } from "../hooks/useAuth";

type ActivePage = "home" | "projects" | "runs" | "settings";

type AppLayoutProps = {
  activePage: ActivePage;
  breadcrumb: string;
  hasProjects?: boolean;
  children: React.ReactNode;
};

export function AppLayout({ activePage, breadcrumb, hasProjects, children }: AppLayoutProps) {
  const { t } = useTranslation();
  const { signOut, session } = useAuth();
  const navigate = useNavigate();
  const avatarUrl = session?.user?.user_metadata?.["avatar_url"] as string | undefined;

  const navItem = (
    page: ActivePage | null,
    to: string,
    icon: string,
    label: string,
    disabled = false,
  ) => {
    const isActive = page !== null && activePage === page;
    const base = "flex items-center gap-3 h-10 pl-4 text-sm tracking-tight transition-colors";
    const active = "text-zinc-950 font-bold border-l-2 border-zinc-950 bg-zinc-50";
    const inactive = "text-zinc-500 hover:text-zinc-950 hover:bg-zinc-50";
    const disabledCls = "opacity-50 cursor-not-allowed pointer-events-none";

    if (disabled) {
      return (
        <span className={`${base} ${inactive} ${disabledCls}`}>
          <span className="material-symbols-outlined text-[20px]">{icon}</span>
          {label}
        </span>
      );
    }

    return (
      <Link to={to} className={`${base} ${isActive ? active : inactive}`}>
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
        {label}
      </Link>
    );
  };

  return (
    <div className="flex bg-background text-on-surface min-h-screen font-body">

      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-60 bg-white border-r border-zinc-200 flex flex-col py-4 z-50">
        <div className="px-4 mb-8">
          <img src="/logo.jpg" alt="CodeShield" className="h-14 w-auto" />
        </div>

        <nav className="flex-1 px-2 space-y-1">
          {navItem("home", "/dashboard", "home", t("dashboard.nav.home"))}
          {hasProjects && navItem("projects", "/projects", "folder", t("dashboard.nav.projects"))}
          {hasProjects && navItem("runs", "/runs", "history", t("dashboard.nav.runs"))}
          {navItem("settings", "/settings", "settings", t("dashboard.nav.settings"))}
        </nav>

        <div className="px-2 pt-4 mt-4 border-t border-zinc-100 space-y-1">
          <button
            onClick={() => void signOut().then(() => navigate("/"))}
            className="flex items-center gap-3 h-10 w-full text-zinc-500 pl-4 hover:text-zinc-950 hover:bg-zinc-50 transition-colors text-sm tracking-tight"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            {t("dashboard.nav.logOut")}
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="ml-60 min-h-screen flex flex-col flex-1">

        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white border-b border-zinc-200 h-14 px-6 flex justify-between items-center">
          <span className="text-sm font-medium tracking-tight text-zinc-950">{breadcrumb}</span>
          <div className="flex items-center gap-4">
            <a
              href="/about"
              target="_blank"
              rel="noopener noreferrer"
              title={t("about.navTooltip")}
              aria-label={t("about.navTooltip")}
              className="p-2 text-zinc-500 hover:bg-zinc-50 rounded transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">help</span>
            </a>
            <button className="p-2 text-zinc-500 hover:bg-zinc-50 rounded transition-colors">
              <span className="material-symbols-outlined text-[20px]">notifications</span>
            </button>
            <div className="w-8 h-8 rounded-full bg-zinc-200 overflow-hidden ml-2 flex-shrink-0">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs font-bold">
                  {session?.user?.email?.[0]?.toUpperCase() ?? "U"}
                </div>
              )}
            </div>
          </div>
        </header>

        {children}
      </div>
    </div>
  );
}
