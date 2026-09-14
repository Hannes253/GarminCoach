export interface IntensitySegment {
  key: "easy" | "moderate" | "hard";
  label: string;
  pct: number;
}

const SEGMENT_STYLE: Record<IntensitySegment["key"], { color: string; textClass: string }> = {
  easy: { color: "var(--chart-intensity-1)", textClass: "fill-foreground" },
  moderate: { color: "var(--chart-intensity-2)", textClass: "fill-white" },
  hard: { color: "var(--chart-intensity-3)", textClass: "fill-white" },
};

/**
 * Easy/moderate/hard time-in-zone split as an ordinal stacked bar - one hue,
 * monotone light->dark steps encode increasing intensity (not distinct
 * identities), per the dataviz skill's ordinal ramp rules. A 2px surface gap
 * separates the segments instead of a border.
 */
export function IntensityBar({ segments }: { segments: IntensitySegment[] }) {
  const width = 320;
  const height = 32;
  const gap = 2;

  const bars = segments.map((seg, i) => ({
    ...seg,
    x: segments.slice(0, i).reduce((sum, s) => sum + (s.pct / 100) * width, 0),
    width: Math.max(0, (seg.pct / 100) * width - (i === 0 || i === segments.length - 1 ? gap / 2 : gap)),
  }));

  return (
    <div className="flex flex-col gap-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Intensitätsverteilung">
        {bars.map((bar, i) => {
          const style = SEGMENT_STYLE[bar.key];
          const isFirst = i === 0;
          const isLast = i === bars.length - 1;
          const labelFits = bar.width >= 26;
          return (
            <g key={bar.key}>
              <path
                d={roundedBarPath(bar.x, 0, bar.width, height, isFirst, isLast, 6)}
                fill={style.color}
              />
              {labelFits && (
                <text
                  x={bar.x + bar.width / 2}
                  y={height / 2 + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  className={style.textClass}
                >
                  {bar.pct.toFixed(0)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        {segments.map((seg) => (
          <span key={seg.key} className="flex items-center gap-1.5">
            <span aria-hidden className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: SEGMENT_STYLE[seg.key].color }} />
            {seg.label} {seg.pct.toFixed(0)}%
          </span>
        ))}
      </div>
    </div>
  );
}

function roundedBarPath(
  x: number,
  y: number,
  width: number,
  height: number,
  roundLeft: boolean,
  roundRight: boolean,
  radius: number,
): string {
  const r = Math.min(radius, height / 2, width / 2 || radius);
  const rl = roundLeft ? r : 0;
  const rr = roundRight ? r : 0;
  return `
    M${x + rl},${y}
    H${x + width - rr}
    ${rr ? `A${rr},${rr} 0 0 1 ${x + width},${y + rr}` : `L${x + width},${y}`}
    V${y + height - rr}
    ${rr ? `A${rr},${rr} 0 0 1 ${x + width - rr},${y + height}` : `L${x + width},${y + height}`}
    H${x + rl}
    ${rl ? `A${rl},${rl} 0 0 1 ${x},${y + height - rl}` : `L${x},${y + height}`}
    V${y + rl}
    ${rl ? `A${rl},${rl} 0 0 1 ${x + rl},${y}` : `L${x},${y}`}
    Z
  `;
}
