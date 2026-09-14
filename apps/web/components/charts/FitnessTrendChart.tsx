"use client";

import { useMemo, useState } from "react";

export interface FitnessTrendPoint {
  date: string; // YYYY-MM-DD
  ctl: number;
  atl: number;
}

const WIDTH = 320;
const HEIGHT = 150;
const PAD_LEFT = 8;
const PAD_RIGHT = 8;
const PAD_TOP = 22; // room for end-labels
const PAD_BOTTOM = 20; // room for the date axis label

function formatShortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", timeZone: "UTC" });
}

/**
 * CTL/ATL trend as a two-series line chart. Categorical pair (CTL = accent
 * blue, ATL = --chart-atl teal) validated with the dataviz skill's palette
 * checker: passes CVD + normal-vision separation in both light and dark
 * mode, with a contrast WARN against the light surface for ATL - mitigated
 * here by the always-present legend + end labels (never color-only identity).
 */
export function FitnessTrendChart({ points }: { points: FitnessTrendPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => Math.max(p.ctl, p.atl)));
    return Math.ceil((max * 1.15) / 5) * 5;
  }, [points]);

  const xAt = (i: number) => PAD_LEFT + (points.length <= 1 ? 0 : (i / (points.length - 1)) * plotWidth);
  const yAt = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  if (points.length < 2) {
    return <p className="text-sm text-muted">Noch nicht genug Verlaufsdaten für einen Trend.</p>;
  }

  const ctlPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.ctl)}`).join(" ");
  const atlPath = points.map((p, i) => `${i === 0 ? "M" : "L"}${xAt(i)},${yAt(p.atl)}`).join(" ");
  const ctlAreaPath = `${ctlPath} L${xAt(points.length - 1)},${PAD_TOP + plotHeight} L${xAt(0)},${PAD_TOP + plotHeight} Z`;

  const last = points[points.length - 1]!;
  const gridSteps = 3;
  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  function handlePointerMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const relX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const ratio = Math.min(1, Math.max(0, (relX - PAD_LEFT) / plotWidth));
    const idx = Math.round(ratio * (points.length - 1));
    setHoverIndex(idx);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-4 text-xs text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-ctl)" }} />
          Fitness (CTL)
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="inline-block h-0.5 w-3.5 rounded-full" style={{ background: "var(--chart-atl)" }} />
          Ermüdung (ATL)
        </span>
      </div>

      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full touch-none" role="img" aria-label="Fitness- und Ermüdungsverlauf">
        {Array.from({ length: gridSteps + 1 }, (_, i) => {
          const v = (maxValue / gridSteps) * i;
          const y = yAt(v);
          return (
            <line key={i} x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={y} y2={y} stroke="var(--separator)" strokeWidth={1} />
          );
        })}

        <path d={ctlAreaPath} fill="var(--chart-ctl)" opacity={0.1} stroke="none" />
        <path d={atlPath} fill="none" stroke="var(--chart-atl)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <path d={ctlPath} fill="none" stroke="var(--chart-ctl)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

        {/* End markers with a surface-color ring so they stay legible where the lines cross. */}
        <circle cx={xAt(points.length - 1)} cy={yAt(last.atl)} r={4} fill="var(--chart-atl)" stroke="var(--card)" strokeWidth={2} />
        <circle cx={xAt(points.length - 1)} cy={yAt(last.ctl)} r={4} fill="var(--chart-ctl)" stroke="var(--card)" strokeWidth={2} />

        {/* Direct end-labels (values lead, sparingly placed per dataviz rules). */}
        <text x={xAt(points.length - 1)} y={Math.max(10, yAt(last.ctl) - 8)} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--foreground)">
          {last.ctl.toFixed(0)}
        </text>
        <text x={xAt(points.length - 1)} y={yAt(last.atl) + 15} textAnchor="end" fontSize={11} fontWeight={600} fill="var(--foreground)">
          {last.atl.toFixed(0)}
        </text>

        {hovered && (
          <>
            <line
              x1={xAt(hoverIndex!)}
              x2={xAt(hoverIndex!)}
              y1={PAD_TOP}
              y2={PAD_TOP + plotHeight}
              stroke="var(--muted)"
              strokeWidth={1}
            />
            <circle cx={xAt(hoverIndex!)} cy={yAt(hovered.ctl)} r={4} fill="var(--chart-ctl)" stroke="var(--card)" strokeWidth={2} />
            <circle cx={xAt(hoverIndex!)} cy={yAt(hovered.atl)} r={4} fill="var(--chart-atl)" stroke="var(--card)" strokeWidth={2} />
          </>
        )}

        {/* Full-plot hit area: the crosshair snaps to the nearest x, not a 2px line. */}
        <rect
          x={PAD_LEFT}
          y={0}
          width={plotWidth}
          height={HEIGHT}
          fill="transparent"
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHoverIndex(null)}
        />
      </svg>

      <div className="flex h-5 items-center justify-center text-xs text-muted" aria-live="polite">
        {hovered
          ? `${formatShortDate(hovered.date)} · CTL ${hovered.ctl.toFixed(0)} · ATL ${hovered.atl.toFixed(0)}`
          : `${formatShortDate(points[0]!.date)} – ${formatShortDate(last.date)}`}
      </div>
    </div>
  );
}
