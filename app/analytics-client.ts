'use client';
// Cookieless usage beacons: fire-and-forget, same-origin POSTs that never
// carry account identifiers. Failures are silent — analytics must never
// surface in the UI or block a user action.
export type AnalyticsEvent = {type: 'view' | 'search' | 'event_view' | 'export' | 'save' | 'share' | 'view_switch' | 'directions'; name?: string; detail?: string};

export function track(event: AnalyticsEvent) {
  try {
    void fetch('/api/analytics', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({events: [event]}), keepalive: true}).catch(() => {});
  } catch {/* ignored by design */}
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;
// Searches are recorded once typing settles, with the live result count, so
// the dashboard's zero-result list reflects real coverage gaps rather than
// every intermediate keystroke.
export function trackSearch(query: string, results: number) {
  const text = query.trim();
  if (text.length < 2) return;
  if (searchTimer) clearTimeout(searchTimer);
  searchTimer = setTimeout(() => track({type: 'search', name: text.slice(0, 120), detail: String(results)}), 1200);
}
