"use client";

import { useState } from "react";

export interface BarChartPoint {
  key: string;
  label: string;
  value: number;
}

const WIDTH = 320;
const HEIGHT = 130;
const PAD_TOP = 20;
const PAD_BOTTOM = 18;
const MAX_BAR_THICKNESS = 24;
const BAR_GAP = 4;

/**
 * Single-series magnitude bar chart (sequential: one hue, the app's accent
 * blue). Used for weekly volume and long-run progression - both are "how
 * much", not distinct identities, so one hue is correct per the dataviz
 * skill (no legend needed for a single series; the card title names it).
 */
export function BarChart({
  points,
  valueSuffix = "",
  targetValue,
  targetLabel,
  formatValue = (v) => v.toFixed(0),
}: {
  points: BarChartPoint[];
  valueSuffix?: string;
  targetValue?: number;
  targetLabel?: string;
  formatValue?: (v: number) => string;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (points.length === 0) {
    return <p className="text-sm text-muted">Noch keine Daten.</p>;
  }

  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const maxValue = Math.max(1, ...points.map((p) => p.value), targetValue ?? 0) * 1.1;
  const yAt = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const slotWidth = WIDTH / points.length;
  const barWidth = Math.min(MAX_BAR_THICKNESS, slotWidth - BAR_GAP);

  const hovered = hoverIndex != null ? points[hoverIndex] : null;

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" role="img" aria-label="Balkendiagramm">
        {targetValue != null && (
          <>
            <line
              x1={0}
              x2={WIDTH}
              y1={yAt(targetValue)}
              y2={yAt(targetValue)}
              stroke="var(--muted)"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
            {targetLabel && (
              <text x={WIDTH} y={yAt(targetValue) - 4} textAnchor="end" fontSize={9} fill="var(--muted)">
                {targetLabel}
              </text>
            )}
          </>
        )}

        {points.map((p, i) => {
          const x = i * slotWidth + (slotWidth - barWidth) / 2;
          const y = yAt(p.value);
          const h = PAD_TOP + plotHeight - y;
          const isHovered = hoverIndex === i;
          const labelFits = barWidth >= 18;

          return (
            <g key={p.key}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(0, h)}
                rx={4}
                fill="var(--chart-ctl)"
                opacity={isHovered ? 1 : 0.85}
              />
              {labelFits && (
                <text x={x + barWidth / 2} y={y - 4} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--foreground)">
                  {formatValue(p.value)}
                </text>
              )}
              <text x={x + barWidth / 2} y={HEIGHT - 4} textAnchor="middle" fontSize={9} fill="var(--muted)">
                {p.label}
              </text>
              {/* Hit target covers the full slot, not just the painted bar. */}
              <rect
                x={i * slotWidth}
                y={0}
                width={slotWidth}
                height={HEIGHT}
                fill="transparent"
                onPointerEnter={() => setHoverIndex(i)}
                onPointerLeave={() => setHoverIndex(null)}
              />
            </g>
          );
        })}
      </svg>

      <div className="flex h-5 items-center justify-center text-xs text-muted" aria-live="polite">
        {hovered ? `${hovered.label}: ${formatValue(hovered.value)}${valueSuffix}` : " "}
      </div>
    </div>
  );
}
