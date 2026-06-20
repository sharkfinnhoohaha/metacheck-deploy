"use client";

import { useState } from "react";
import Link from "next/link";
import { IconCheck } from "@/app/_components/icons";

type Plan = {
  id: "pro" | "team";
  name: string;
  monthly: string;
  annual: string;
  annualNote: string;
  features: string[];
};

// Display prices only — the real amounts live in the Stripe/PayPal products you
// create. Keep these in sync with those products.
const PLANS: Plan[] = [
  {
    id: "pro",
    name: "Pro",
    monthly: "$9",
    annual: "$49",
    annualNote: "save ~55%",
    features: ["Unlimited validations", "300 AI fixes/month", "All rules + distributor profiles", "PDF reports", "History"],
  },
  {
    id: "team",
    name: "Label",
    monthly: "$29",
    annual: "$290",
    annualNote: "save ~17%",
    features: ["Unlimited everything", "1500 AI fixes/month", "Batch / catalog mode", "Priority support", "Custom rules"],
  },
];

export function UpgradePlans() {
  const [interval, setInterval] = useState<"month" | "year">("year");

  return (
    <div>
      {/* Billing-interval toggle */}
      <div className="inline-flex items-center rounded-lg border border-border bg-bg-card p-1 mb-4">
        <button
          type="button"
          onClick={() => setInterval("month")}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
            interval === "month" ? "bg-surface text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setInterval("year")}
          className={`px-3 py-1.5 rounded-md text-xs transition-colors ${
            interval === "year" ? "bg-surface text-text" : "text-text-muted hover:text-text"
          }`}
        >
          Annual <span className="text-green">· save</span>
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {PLANS.map((plan) => (
          <div key={plan.id} className="rounded-xl border border-border bg-bg-card p-6 flex flex-col gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-text">{plan.name}</h3>
                <span className="text-accent-bright text-sm nums">
                  {interval === "year" ? `${plan.annual}/yr` : `${plan.monthly}/mo`}
                </span>
              </div>
              {interval === "year" && (
                <p className="text-xs text-green">{plan.annualNote} vs monthly</p>
              )}
              <ul className="space-y-1.5 mt-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-text-muted">
                    <IconCheck size={14} className="text-green shrink-0" /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <Link
              href={`/api/checkout?tier=${plan.id}&interval=${interval}`}
              prefetch={false}
              className="w-full text-center py-2.5 rounded-lg bg-accent text-white text-sm font-semibold hover:bg-accent-bright transition-colors"
            >
              Upgrade to {plan.name}
            </Link>
            <Link
              href={`/api/paypal/checkout?tier=${plan.id}&interval=${interval}`}
              prefetch={false}
              className="w-full text-center py-2 rounded-lg border border-border-bright text-xs text-text-muted hover:text-text hover:border-text-dim transition-colors -mt-2"
            >
              or pay with PayPal
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
