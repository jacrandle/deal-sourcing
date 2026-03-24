// All API calls go to /api/* — Netlify redirects to /.netlify/functions/*

const BASE = "/api";

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

// ─── Stats ─────────────────────────────────────────────────────────────────

export function getStats() {
  return request("/stats");
}

// ─── Providers ─────────────────────────────────────────────────────────────

export function getProviders({ tier, sort_by, limit } = {}) {
  const params = new URLSearchParams();
  if (tier) params.set("tier", tier);
  if (sort_by) params.set("sort_by", sort_by);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return request(`/providers${qs ? `?${qs}` : ""}`);
}

export function getProvider(ccn) {
  return request(`/provider?ccn=${encodeURIComponent(ccn)}`);
}

// ─── CRM ───────────────────────────────────────────────────────────────────

export function getCrmPipeline() {
  return request("/crm");
}

export function addToPipeline(data) {
  return request("/crm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function updatePipelineEntry(id, data) {
  return request(`/crm?id=${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

export function deletePipelineEntry(id) {
  return request(`/crm?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

// ─── Alerts ────────────────────────────────────────────────────────────────

export function getAlerts() {
  return request("/alerts");
}

export function acknowledgeAlert(id) {
  return request("/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "acknowledge", id }),
  });
}
