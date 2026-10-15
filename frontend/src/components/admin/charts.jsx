/**
 * charts
 * The dashboard's graphs, drawn by hand as SVG / CSS so there is nothing to
 * install (same idea as the inline gear icon in ProfileTabs). Styling lives in
 * admin.css under `.ad-chart`, `.ad-legend`, `.ad-bars`, `.ad-cols`, `.ad-donut`.
 *
 *   <AreaChart labels={days} series={[{ name, color, values }]} />   lines over time, hover for values
 *   <Sparkline values={[…]} />                                       tiny trend line for a stamp
 *   <Donut slices={[{ label, value, color }]} />                     share of a whole, with a legend
 *   <BarList items={[{ label, value }]} />                           ranked horizontal bars
 *   <Columns items={[{ label, value }]} />                           a small histogram
 *
 * Colours are passed in as CSS variables (e.g. "var(--pd-maroon)") so they
 * follow theme.css. Every chart carries a text summary for screen readers, and
 * the numbers are always printed somewhere (legend, bar end, column top) — the
 * colour is never the only way to read one.
 */
import { useEffect, useId, useRef, useState } from "react";
import { formatNumber, shortDate } from "./format";

export const COLORS = {
  maroon: "var(--pd-maroon)",
  salmon: "var(--pd-salmon)",
  ink: "var(--pd-ink)",
  green: "var(--pd-green)",
  pink: "var(--pd-pink)",
  grey: "var(--pd-grey)",
};

/* ── helpers ─────────────────────────────────────────────────────────────── */

/** Rounds the top of an axis up to a tidy number, with whole-number steps. */
export function niceScale(maxValue, intervals = 4) {
  const raw = Math.max(maxValue, 1) / intervals;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const n = raw / pow;
  const step = Math.max(1, (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow);
  return { step, max: step * intervals };
}

/**
 * A smooth line through the points that never overshoots them (monotone cubic,
 * Fritsch–Carlson). A plain curve would dip below zero between a 0 and a 5.
 */
export function monotonePath(points) {
  const n = points.length;
  const r = (v) => Math.round(v * 100) / 100;
  if (n === 0) return "";
  if (n === 1) return `M${r(points[0].x)},${r(points[0].y)}`;

  const dx = [];
  const slope = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx[i] = points[i + 1].x - points[i].x;
    slope[i] = (points[i + 1].y - points[i].y) / dx[i];
  }
  const m = [slope[0]];
  for (let i = 1; i < n - 1; i += 1) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2;
  }
  m[n - 1] = slope[n - 2];

  for (let i = 0; i < n - 1; i += 1) {
    if (slope[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / slope[i];
    const b = m[i + 1] / slope[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * slope[i];
      m[i + 1] = t * b * slope[i];
    }
  }

  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i];
    d +=
      ` C${r(points[i].x + h / 3)},${r(points[i].y + (m[i] * h) / 3)}` +
      ` ${r(points[i + 1].x - h / 3)},${r(points[i + 1].y - (m[i + 1] * h) / 3)}` +
      ` ${r(points[i + 1].x)},${r(points[i + 1].y)}`;
  }
  return d;
}

/** Tracks an element's pixel width so the SVG can be drawn 1:1 (text never shrinks on a phone). */
function useWidth(ref, fallback = 640) {
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const update = () => setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

/* ── AreaChart ───────────────────────────────────────────────────────────── */

/**
 * One or more lines over time. `labels` are day keys ("2026-09-03"); every
 * series needs a `values` array the same length. Hover (or touch) a day to
 * read the exact numbers. Give a series `dashed: true` to tell two lines apart
 * without relying on colour.
 */
export function AreaChart({ labels, series, height = 250, ariaLabel }) {
  const uid = useId().replace(/:/g, "");
  const wrapRef = useRef(null);
  const width = useWidth(wrapRef);
  const [hover, setHover] = useState(null);

  const pad = { top: 14, right: 16, bottom: 28, left: 40 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const count = labels.length;

  const maxValue = Math.max(0, ...series.flatMap((s) => s.values));
  const { step, max } = niceScale(maxValue);

  const xAt = (i) => pad.left + (count <= 1 ? innerW / 2 : (i / (count - 1)) * innerW);
  const yAt = (v) => pad.top + innerH - (v / max) * innerH;

  const ticks = [0, 1, 2, 3, 4].map((k) => k * step);
  const labelEvery = Math.max(1, Math.ceil(count / Math.max(2, Math.floor(innerW / 76))));

  function handleMove(e) {
    const rect = wrapRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const i = Math.round(((x - pad.left) / innerW) * (count - 1));
    setHover(Math.min(count - 1, Math.max(0, i)));
  }

  const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
  const summary =
    ariaLabel ??
    `Line chart, ${shortDate(labels[0])} to ${shortDate(labels[count - 1])}. ` +
      series.map((s, i) => `${s.name}: ${formatNumber(totals[i])} in total`).join(". ");

  return (
    <div className="ad-chart">
      <ul className="ad-legend ad-legend-inline">
        {series.map((s, i) => (
          <li key={s.name}>
            <svg width="22" height="8" aria-hidden="true">
              <line
                x1="1"
                y1="4"
                x2="21"
                y2="4"
                stroke={s.color}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={s.dashed ? "5 4" : undefined}
              />
            </svg>
            <span>{s.name}</span>
            <strong>{formatNumber(totals[i])}</strong>
          </li>
        ))}
      </ul>

      <div
        className="ad-chart-plot"
        ref={wrapRef}
        style={{ height }}
        onPointerMove={handleMove}
        onPointerDown={handleMove}
        onPointerLeave={() => setHover(null)}
      >
        <svg width={width} height={height} role="img" aria-label={summary}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={s.name} id={`${uid}g${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity="0.2" />
                <stop offset="1" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            ))}
          </defs>

          {ticks.map((t) => (
            <g key={t}>
              <line className="ad-grid" x1={pad.left} x2={width - pad.right} y1={yAt(t)} y2={yAt(t)} />
              <text className="ad-axis" x={pad.left - 8} y={yAt(t) + 4} textAnchor="end">
                {formatNumber(t)}
              </text>
            </g>
          ))}

          {labels.map((day, i) =>
            i % labelEvery === 0 ? (
              <text key={day} className="ad-axis" x={xAt(i)} y={height - 8} textAnchor="middle">
                {shortDate(day)}
              </text>
            ) : null
          )}

          {series.map((s, i) => {
            const points = s.values.map((v, j) => ({ x: xAt(j), y: yAt(v) }));
            const line = monotonePath(points);
            return (
              <g key={s.name}>
                {count > 1 && (
                  <path
                    d={`${line} L${xAt(count - 1)},${yAt(0)} L${xAt(0)},${yAt(0)} Z`}
                    fill={`url(#${uid}g${i})`}
                  />
                )}
                <path
                  d={line}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray={s.dashed ? "6 5" : undefined}
                />
              </g>
            );
          })}

          {/* The reveal: a cream rectangle sitting on the plot that slides away
              once on load. (Reduced-motion users get it instantly — see theme.css.) */}
          <rect
            className="ad-wipe"
            x={pad.left}
            y={0}
            width={innerW + pad.right}
            height={height - pad.bottom}
          />

          {hover !== null && (
            <g pointerEvents="none">
              <line className="ad-cursor" x1={xAt(hover)} x2={xAt(hover)} y1={pad.top} y2={yAt(0)} />
              {series.map((s) => (
                <circle key={s.name} cx={xAt(hover)} cy={yAt(s.values[hover])} r="4.5" fill="var(--pd-cream)" stroke={s.color} strokeWidth="2.5" />
              ))}
            </g>
          )}
        </svg>

        {hover !== null && (
          <div
            className="ad-tip"
            style={{ left: Math.min(width - 96, Math.max(96, xAt(hover))) }}
            role="status"
          >
            <p className="ad-tip-title">{shortDate(labels[hover])}</p>
            {series.map((s) => (
              <p key={s.name} className="ad-tip-row">
                <span>{s.name}</span>
                <strong>{formatNumber(s.values[hover])}</strong>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Sparkline ───────────────────────────────────────────────────────────── */

export function Sparkline({ values, color = COLORS.maroon, height = 30 }) {
  const w = 100;
  const n = values.length;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => ({
    x: n <= 1 ? w / 2 : (i / (n - 1)) * w,
    y: height - 3 - (v / max) * (height - 8),
  }));
  const last = pts[pts.length - 1];
  return (
    <div className="ad-spark" style={{ height }} aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
        <path d={monotonePath(pts)} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
      </svg>
      {/* The line is stretched to fit the stamp, which would squash a circle drawn inside the SVG, so the end dot is plain HTML. */}
      {last && <i className="ad-spark-dot" style={{ top: `${(last.y / height) * 100}%`, background: color }} />}
    </div>
  );
}

/* ── Donut ───────────────────────────────────────────────────────────────── */

/**
 * A ring split into slices, with the legend (name, count, percent) beside it.
 * Zero-value slices are dropped from the ring but kept in the legend.
 */
export function Donut({ slices, centerValue, centerLabel, size = 148 }) {
  const total = slices.reduce((sum, s) => sum + s.value, 0);
  const R = 15.9155; // a circle whose circumference is exactly 100
  const live = slices.filter((s) => s.value > 0);
  const gap = live.length > 1 ? 0.9 : 0;

  let consumed = 0;
  const arcs = live.map((s) => {
    const length = (s.value / total) * 100;
    const arc = { ...s, dash: Math.max(0, length - gap), offset: 25 - consumed };
    consumed += length;
    return arc;
  });

  const summary =
    total === 0
      ? "No data yet"
      : slices.map((s) => `${s.label}: ${formatNumber(s.value)}`).join(", ");

  return (
    <div className="ad-donut">
      <div className="ad-donut-ring" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" role="img" aria-label={summary}>
          <circle cx="21" cy="21" r={R} fill="none" stroke="var(--pd-tan)" strokeWidth="5.2" />
          {arcs.map((a) => (
            <circle
              key={a.label}
              className="ad-donut-arc"
              cx="21"
              cy="21"
              r={R}
              fill="none"
              stroke={a.color}
              strokeWidth="5.2"
              strokeDasharray={`${a.dash} ${100 - a.dash}`}
              strokeDashoffset={a.offset}
            />
          ))}
        </svg>
        <div className="ad-donut-center">
          <strong>{centerValue ?? formatNumber(total)}</strong>
          {centerLabel && <span>{centerLabel}</span>}
        </div>
      </div>

      <ul className="ad-legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="ad-swatch" style={{ background: s.color }} aria-hidden="true" />
            <span>{s.label}</span>
            <strong>{formatNumber(s.value)}</strong>
            <em>{total ? `${Math.round((s.value / total) * 100)}%` : "0%"}</em>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── BarList ─────────────────────────────────────────────────────────────── */

/** Ranked horizontal bars. Pass `max` to fix the scale (e.g. 5 for a 1–5 rating). */
export function BarList({ items, max, format = formatNumber, color = COLORS.maroon }) {
  const top = max ?? Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="ad-bars">
      {items.map((item) => (
        <li key={item.label}>
          <span className="ad-bars-label">{item.label}</span>
          <span className="ad-bars-track" aria-hidden="true">
            <span
              className="ad-bars-fill"
              style={{ width: `${Math.min(100, (item.value / top) * 100)}%`, background: item.color ?? color }}
            />
          </span>
          <strong className="ad-bars-value">{format(item.value)}</strong>
        </li>
      ))}
    </ul>
  );
}

/* ── Columns ─────────────────────────────────────────────────────────────── */

/** A small vertical histogram. The count sits on top of each column. */
export function Columns({ items, height = 132, color = COLORS.maroon, caption }) {
  const top = Math.max(1, ...items.map((i) => i.value));
  return (
    <figure className="ad-cols-figure">
      <div className="ad-cols" role="list" style={{ "--ad-cols-h": `${height}px` }}>
        {items.map((item) => (
          <div className="ad-col" role="listitem" key={item.label} aria-label={`${item.label}: ${item.value}`}>
            <div className="ad-col-area">
              <span className="ad-col-bar" style={{ height: `${(item.value / top) * 100}%`, background: color }}>
                <b>{formatNumber(item.value)}</b>
              </span>
            </div>
            <span className="ad-col-label">{item.label}</span>
          </div>
        ))}
      </div>
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
