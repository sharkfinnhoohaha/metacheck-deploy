"use client";

import { useEffect, useState } from "react";

type KeyRow = {
  id: string;
  name: string | null;
  prefix: string;
  last_used_at: string | null;
  created_at: string;
};

export function ApiKeys() {
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null); // plaintext shown once
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch("/api/keys");
      const json = await res.json();
      setKeys(json.data?.keys ?? []);
    } catch {
      /* leave list as-is */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    setCreating(true);
    setError(null);
    setFresh(null);
    try {
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error || "Couldn't create key."); return; }
      setFresh(json.data.key);
      setName("");
      await load();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setCreating(false);
    }
  };

  const revoke = async (id: string) => {
    setError(null);
    const res = await fetch(`/api/keys?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (!res.ok) { setError("Couldn't revoke key."); return; }
    await load();
  };

  return (
    <div className="rounded-xl border border-border bg-bg-card p-6">
      <p className="text-sm text-text-muted mb-4">
        Validate metadata programmatically. Send <code className="text-text">POST</code> to{" "}
        <code className="text-text">/api/v1/validate</code> with{" "}
        <code className="text-text">Authorization: Bearer mc_live_…</code> and a{" "}
        <code className="text-text">{"{ tracks: [...] }"}</code> body.
      </p>

      {fresh && (
        <div className="mb-4 rounded-lg border border-accent/30 bg-accent/5 p-4">
          <p className="text-xs text-text-muted mb-1">Copy your key now — it won&apos;t be shown again:</p>
          <code className="block text-sm text-accent-bright break-all font-mono">{fresh}</code>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Key name (e.g. CI)"
          maxLength={60}
          className="flex-1 px-3.5 py-2.5 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all"
        />
        <button
          onClick={create}
          disabled={creating}
          className="press shrink-0 px-4 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create key"}
        </button>
      </div>

      {error && <p className="text-sm text-red mb-3">{error}</p>}

      {loading ? (
        <p className="text-sm text-text-dim">Loading…</p>
      ) : keys.length === 0 ? (
        <p className="text-sm text-text-dim">No API keys yet.</p>
      ) : (
        <ul className="space-y-2">
          {keys.map((k) => (
            <li key={k.id} className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-border bg-surface/40">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-text font-medium truncate">{k.name || "Untitled key"}</p>
                <p className="text-xs text-text-dim font-mono">
                  {k.prefix} · {k.last_used_at ? `last used ${new Date(k.last_used_at).toLocaleDateString()}` : "never used"}
                </p>
              </div>
              <button
                onClick={() => revoke(k.id)}
                className="shrink-0 text-xs text-text-muted hover:text-red transition-colors"
              >
                Revoke
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
