import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "../lib/supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

export function GitHubCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const called = useRef(false);

  useEffect(() => {
    if (called.current) return;
    called.current = true;

    const installationId = searchParams.get("installation_id");
    const setupAction = searchParams.get("setup_action");

    if (!installationId || !setupAction) {
      navigate("/dashboard", { replace: true });
      return;
    }

    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const token = data.session?.access_token;

        const url = `${API_BASE}/integrations/github/install-callback?installation_id=${installationId}&setup_action=${setupAction}`;
        const res = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!res.ok) {
          console.error("install-callback failed", res.status, await res.text());
        }
      } catch (err) {
        console.error("install-callback error", err);
      } finally {
        navigate("/dashboard?installed=1", { replace: true });
      }
    })();
  }, [navigate, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("githubCallback.processing")}</p>
    </div>
  );
}
