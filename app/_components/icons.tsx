/**
 * Minimal inline line-icon set (currentColor, 1.5 stroke) — replaces the emoji
 * and unicode glyphs across the app so iconography is consistent and crisp.
 */
import type { SVGProps } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "strokeWidth"> & { size?: number; strokeWidth?: number };

function base(p: IconProps) {
  const { size = 20, strokeWidth = 1.6, ...props } = p;
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export const IconGrid = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/></svg>
);

export const IconCheckShield = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg>
);

export const IconClock = (p: IconProps) => (
  <svg {...base(p)}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
);

export const IconSliders = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M16 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="8" cy="12" r="2"/><circle cx="14" cy="18" r="2"/></svg>
);

export const IconFingerprint = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 11a2 2 0 0 1 2 2c0 2-.3 3.8-1 5.5"/><path d="M8.5 8.5A5 5 0 0 1 17 12c0 2.5-.4 4.8-1.2 7"/><path d="M5.5 11a6.5 6.5 0 0 1 13 0c0 .9-.1 1.8-.3 2.6"/><path d="M8 13c0 2.4-.5 4.6-1.5 6.5"/></svg>
);

export const IconPen = (p: IconProps) => (
  <svg {...base(p)}><path d="M15 4l5 5L8 21l-5 1 1-5L15 4z"/><path d="M13.5 6.5l4 4"/></svg>
);

export const IconType = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 6V4h14v2"/><path d="M12 4v16"/><path d="M9 20h6"/></svg>
);

export const IconNote = (p: IconProps) => (
  <svg {...base(p)}><circle cx="7" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="M10 18V5l11-2v13"/></svg>
);

export const IconCalendar = (p: IconProps) => (
  <svg {...base(p)}><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 9h18M8 3v4M16 3v4"/></svg>
);

export const IconSparkles = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 3l1.8 4.7L18.5 9.5 13.8 11.3 12 16l-1.8-4.7L5.5 9.5l4.7-1.8L12 3z"/><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z"/></svg>
);

export const IconClapper = (p: IconProps) => (
  <svg {...base(p)}><path d="M3 8l18-2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8z"/><path d="M3 8l2.5-3 4 .5L7 8.5M9.5 5.5L14 5l-2.5 3.5M14 5l4.5-.5L16 8"/></svg>
);

export const IconRobot = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="8" width="16" height="11" rx="2.5"/><path d="M12 4v4M8 14h.01M16 14h.01M9.5 17h5"/><circle cx="12" cy="3" r="1"/></svg>
);

export const IconCheck = (p: IconProps) => (
  <svg {...base(p)}><path d="M4 12l5 5L20 6"/></svg>
);

export const IconArrowRight = (p: IconProps) => (
  <svg {...base(p)}><path d="M5 12h14M13 6l6 6-6 6"/></svg>
);

export const IconArrowDown = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 5v14M6 13l6 6 6-6"/></svg>
);

export const IconLock = (p: IconProps) => (
  <svg {...base(p)}><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
);

export const IconSearch = (p: IconProps) => (
  <svg {...base(p)}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
);

export const IconBolt = (p: IconProps) => (
  <svg {...base(p)}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>
);

export const IconUpload = (p: IconProps) => (
  <svg {...base(p)}><path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 16v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"/></svg>
);

export const IconChevronDown = (p: IconProps) => (
  <svg {...base(p)}><path d="M6 9l6 6 6-6"/></svg>
);
