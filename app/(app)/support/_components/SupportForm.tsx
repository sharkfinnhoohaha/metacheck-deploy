"use client";

import { useState } from "react";
import { IconCheck } from "@/app/_components/icons";

export function SupportForm({ defaultEmail }: { defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    setError(null);
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, email }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Couldn't submit your message.");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setError("Network error — please try again.");
      setStatus("idle");
    }
  };

  if (status === "sent") {
    return (
      <div className="rounded-xl border border-green/20 bg-green/5 p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-green/10 text-green flex items-center justify-center mx-auto mb-3">
          <IconCheck size={22} />
        </div>
        <p className="text-text font-medium mb-1">Message sent</p>
        <p className="text-sm text-text-muted">We&apos;ll reply to <span className="text-text">{email}</span>. Thanks for reaching out.</p>
      </div>
    );
  }

  const inputClass =
    "w-full px-3.5 py-2.5 bg-bg border border-border rounded-lg text-sm text-text placeholder:text-text-dim focus:outline-none focus:border-accent focus:ring-4 focus:ring-accent/10 transition-all";

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label htmlFor="support-email" className="block text-xs font-medium text-text-muted mb-1.5">Reply-to email</label>
        <input
          id="support-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="support-subject" className="block text-xs font-medium text-text-muted mb-1.5">Subject</label>
        <input
          id="support-subject"
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="What do you need help with?"
          maxLength={200}
          required
          className={inputClass}
        />
      </div>
      <div>
        <label htmlFor="support-body" className="block text-xs font-medium text-text-muted mb-1.5">Message</label>
        <textarea
          id="support-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe the issue or question in as much detail as you can."
          rows={6}
          maxLength={5000}
          required
          className={`${inputClass} resize-y`}
        />
      </div>
      {error && <p className="text-sm text-red">{error}</p>}
      <button
        type="submit"
        disabled={status === "sending"}
        className="press inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors disabled:opacity-50"
      >
        {status === "sending" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
