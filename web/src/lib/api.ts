import { supabase } from "./supabase";

const API_BASE = import.meta.env.VITE_API_BASE_URL as string;

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = await authHeaders();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...headers, ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ── Projects ──────────────────────────────────────────────────────────────────

export type Project = {
  id: string;
  github_repo_full_name: string;
  default_branch: string;
  enabled_specialists: string[];
  severity_threshold: string;
  review_output_locale: string;
  created_at: string;
};

export type ProjectUpdate = Partial<
  Pick<Project, "enabled_specialists" | "severity_threshold" | "review_output_locale">
>;

export const fetchProjects = (): Promise<Project[]> => apiFetch("/projects");

export const fetchProject = (id: string): Promise<Project> => apiFetch(`/projects/${id}`);

export const updateProject = (id: string, body: ProjectUpdate): Promise<Project> =>
  apiFetch(`/projects/${id}`, { method: "PATCH", body: JSON.stringify(body) });

// ── Runs ──────────────────────────────────────────────────────────────────────

export type Run = {
  id: string;
  project_id: string;
  pr_number: number;
  pr_head_sha: string;
  status: string;
  trigger_event: string;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
};

export type Finding = {
  id: number;
  specialist: string;
  severity: string;
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  title: string;
  explanation: string;
  suggested_fix: string | null;
  confidence: string;
  created_at: string;
};

export type RunEvent = {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RunDetail = Run & { findings: Finding[]; events: RunEvent[] };

export const fetchRuns = (projectId: string): Promise<Run[]> =>
  apiFetch(`/projects/${projectId}/runs`);

export const fetchRun = (runId: string): Promise<RunDetail> => apiFetch(`/runs/${runId}`);
