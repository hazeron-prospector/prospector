import { useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { arcPoint, layoutOrrery, nearestArc, ORRERY_VIEWBOX, type OrreryRing } from "@/data/orrery";
import { starColor } from "@/data/mapdata";
import { qualityHsl } from "@/data/color";
import { zoneColor, zonesPresent } from "@/data/zoneColor";
import type { System } from "@/data/types";
import { bestDepositsByBody, hoverResources } from "@/data/systemSummary";
import { Censored } from "./Censored";
import { qualityStyle } from "./quality";
import { ResourceIcon } from "./ResourceIcon";
import { useResourceFilter } from "./state/ResourceFilterContext";
import { isResourceFilterActive } from "./useBodyHighlights";

interface Hover {
  id: string;
  name: string;
  type: string;
  /** Dot position in orrery units. */
  x: number;
  y: number;
}

interface Props {
  system: System;
  size: "compact" | "large";
  /** Bodies (or stars) to ring, e.g. those matching the resource filter. */
  highlightedBodyIds?: ReadonlySet<string>;
  /** Best matching quality per highlighted body; colors the ring. */
  bodyQuality?: ReadonlyMap<string, number>;
  /** Body drawn with a white emphasis ring (body peek). */
  emphasizedBodyId?: string;
  onBodyClick?: (bodyId: string) => void;
}

const rgb = (c: [number, number, number]) =>
  `rgb(${Math.round(c[0] * 255)} ${Math.round(c[1] * 255)} ${Math.round(c[2] * 255)})`;
const HAB = "#4ade80";

/** Top-down 2D orbit preview of a system (BLUEPRINT W11). No three.js. */
export function SystemPreview({
  system,
  size,
  highlightedBodyIds,
  bodyQuality,
  emphasizedBodyId,
  onBodyClick,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const orrery = useMemo(
    () => layoutOrrery(system, highlightedBodyIds),
    [system, highlightedBodyIds],
  );
  const ringColor = (id: string) => {
    const q = bodyQuality?.get(id);
    if (q === undefined) return "#22d3ee";
    const { hue, light } = qualityHsl(q);
    return `hsl(${hue.toFixed(0)} 75% ${light.toFixed(0)}%)`;
  };
  const { allRows, filter, filteredResourceRows } = useResourceFilter();
  const active = isResourceFilterActive(filter);
  const { totals, matches } = useMemo(() => {
    const own = (r: { systemId: string }) => r.systemId === system.systemId;
    return {
      totals: bestDepositsByBody(allRows.filter(own)),
      matches: active
        ? bestDepositsByBody(filteredResourceRows.filter(own))
        : undefined,
    };
  }, [allRows, filteredResourceRows, active, system.systemId]);
  const legend = useMemo(
    () => zonesPresent(orrery.orbits.filter((o) => o.zone !== undefined).map((o) => o.zone)),
    [orrery],
  );
  const [hover, setHover] = useState<Hover | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  // Place the card beside the dot, flipped/clamped to stay inside the preview container.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const card = cardRef.current;
    if (!hover || !box || !card) return;
    const bw = box.clientWidth;
    const bh = box.clientHeight;
    const px = ((hover.x + 100) / 200) * bw;
    const py = ((hover.y + 100) / 200) * bh;
    const gap = 10;
    let left = px + gap;
    if (left + card.offsetWidth > bw) left = px - gap - card.offsetWidth;
    let top = py + gap;
    if (top + card.offsetHeight > bh) top = py - gap - card.offsetHeight;
    card.style.left = `${Math.max(0, Math.min(left, bw - card.offsetWidth))}px`;
    card.style.top = `${Math.max(0, Math.min(top, bh - card.offsetHeight))}px`;
  }, [hover]);
  const hoverProps = (h: Hover) => ({
    onPointerEnter: () => setHover(h),
    onPointerLeave: () => setHover((cur) => (cur?.id === h.id ? null : cur)),
  });
  const hoverRes = hover
    ? hoverResources(totals.get(hover.id) ?? [], matches?.get(hover.id))
    : [];
  const svgRef = useRef<SVGSVGElement>(null);
  /** Nearest arc of a ring to a pointer event (R5), in orrery units. */
  const arcAt = (ring: OrreryRing, e: { clientX: number; clientY: number }) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || box.width === 0) return ring.arcs[0]!;
    const x = ((e.clientX - box.left) / box.width) * 200 - 100;
    const y = ((e.clientY - box.top) / box.height) * 200 - 100;
    return nearestArc(ring, x, y);
  };
  const ringHover = (ring: OrreryRing, e: { clientX: number; clientY: number }) => {
    const arc = arcAt(ring, e);
    const p = arcPoint(ring, arc.deg);
    setHover((cur) =>
      cur?.id === arc.id ? cur : { id: arc.id, name: arc.name, type: arc.bodyType, x: p.x, y: p.y },
    );
  };
  const click = (id: string) =>
    onBodyClick ? () => onBodyClick(id) : undefined;
  const interactive = onBodyClick ? "cursor-pointer" : undefined;

  return (
    <div
      ref={boxRef}
      className={
        size === "large"
          ? "relative mx-auto w-full max-w-[34rem]"
          : "relative w-full"
      }
    >
      <svg
        ref={svgRef}
        viewBox={ORRERY_VIEWBOX}
        role="img"
        aria-label="Orbit preview"
        className="block aspect-square w-full"
      >
        <defs>
          {orrery.stars.map((s) => (
            <radialGradient key={s.id} id={`${uid}-g-${s.id}`}>
              <stop
                offset="0%"
                stopColor={rgb(starColor(s.type))}
                stopOpacity="0.9"
              />
              <stop
                offset="35%"
                stopColor={rgb(starColor(s.type))}
                stopOpacity="0.35"
              />
              <stop
                offset="100%"
                stopColor={rgb(starColor(s.type))}
                stopOpacity="0"
              />
            </radialGradient>
          ))}
        </defs>
        <rect
          x="-100"
          y="-100"
          width="200"
          height="200"
          className="fill-background/40"
        />
        {orrery.orbits.map((o, i) => (
          <circle
            key={i}
            cx={o.cx}
            cy={o.cy}
            r={o.r}
            fill="none"
            stroke={o.zone === undefined ? "currentColor" : zoneColor(o.zone)}
            strokeOpacity={o.zone === undefined ? 0.14 : 0.45}
            strokeWidth="0.4"
            className={o.zone === undefined ? "text-foreground" : undefined}
          />
        ))}
        {orrery.stars.map((s) => (
          <g
            key={s.id}
            className={interactive}
            onClick={click(s.id)}
            {...hoverProps({
              id: s.id,
              name: s.name,
              type: s.type,
              x: s.x,
              y: s.y,
            })}
          >
            <circle
              cx={s.x}
              cy={s.y}
              r={s.r * 2.6}
              fill={`url(#${uid}-g-${s.id})`}
            />
            <circle cx={s.x} cy={s.y} r={s.r} fill={rgb(starColor(s.type))} />
            {(s.highlighted || s.id === emphasizedBodyId) && (
              <circle
                cx={s.x}
                cy={s.y}
                r={s.r + 2.2}
                fill="none"
                stroke={s.id === emphasizedBodyId ? "#fff" : ringColor(s.id)}
                strokeWidth="1.2"
              />
            )}
          </g>
        ))}
        {orrery.rings.map((ring) => (
          <g
            key={ring.id}
            className={interactive}
            onClick={
              onBodyClick ? (e) => onBodyClick(arcAt(ring, e).id) : undefined
            }
            onPointerMove={(e) => ringHover(ring, e)}
            onPointerLeave={() => setHover(null)}
          >
            <circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.r}
              fill="none"
              stroke="transparent"
              strokeWidth="8"
            />
            <circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.r}
              fill="none"
              stroke="#f5c451"
              strokeOpacity="0.8"
              strokeWidth="3"
            />
            <circle
              cx={ring.cx}
              cy={ring.cy}
              r={ring.r}
              fill="none"
              stroke="#fff"
              strokeOpacity="0.45"
              strokeWidth="0.6"
            />
            {ring.arcs
              .filter((a) => a.highlighted || a.id === emphasizedBodyId)
              .map((a) => {
                const p = arcPoint(ring, a.deg);
                const emphasized = a.id === emphasizedBodyId;
                return (
                  <circle
                    key={a.id}
                    cx={p.x}
                    cy={p.y}
                    r={emphasized ? 3.4 : 3}
                    fill="none"
                    stroke={emphasized ? "#fff" : ringColor(a.id)}
                    strokeWidth="1.2"
                  />
                );
              })}
          </g>
        ))}
        {orrery.bodies.filter((b) => !b.ringworld).map((b) => (
          <g
            key={b.id}
            className={interactive}
            onClick={click(b.id)}
            {...hoverProps({
              id: b.id,
              name: b.name,
              type: b.bodyType,
              x: b.x,
              y: b.y,
            })}
          >
            {/* Larger invisible target so tiny moons are clickable. */}
            <circle
              cx={b.x}
              cy={b.y}
              r={Math.max(b.r + 1.5, 3.5)}
              fill="transparent"
            />
            <circle cx={b.x} cy={b.y} r={b.r} fill={b.color} />
            {b.habitable && (
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 1}
                fill="none"
                stroke={HAB}
                strokeWidth="0.8"
                strokeDasharray="1.4 1"
              />
            )}
            {b.highlighted && (
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 2.6}
                fill="none"
                stroke={ringColor(b.id)}
                strokeWidth="1.2"
              />
            )}
            {b.id === emphasizedBodyId && (
              <circle
                cx={b.x}
                cy={b.y}
                r={b.r + 4.2}
                fill="none"
                stroke="#fff"
                strokeWidth="1"
              />
            )}
          </g>
        ))}
      </svg>
      {hover && (
        <div
          ref={cardRef}
          className="pointer-events-none absolute left-0 top-0 z-10 w-max max-w-[min(14rem,100%)] rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md"
        >
          <div className="truncate font-medium">
            <Censored kind="system">{hover.name}</Censored>
          </div>
          <div className="text-[11px] text-muted-foreground">{hover.type}</div>
          {hoverRes.length === 0 ? (
            <div className="mt-1 text-muted-foreground">No resources</div>
          ) : (
            <ul className="mt-1 space-y-0.5">
              {hoverRes.map((r) => (
                <li key={r.resource} className="flex items-center gap-1.5">
                  <ResourceIcon name={r.resource} sphere={r.sphere} size={16} />
                  <span className="min-w-0 flex-1 truncate">{r.resource}</span>
                  {r.match && (
                    <span
                      title="Matches filter"
                      className="text-[10px] font-semibold text-cyan-400"
                    >
                      ●
                    </span>
                  )}
                  <span
                    className="rounded px-1 tabular-nums"
                    style={qualityStyle(r.bestQuality)}
                  >
                    {r.bestQuality}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {legend.length > 0 && (
        <ul
          aria-label="Orbit zones"
          className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground"
        >
          {legend.map((z) => (
            <li key={z} className="flex items-center gap-1">
              <span
                aria-hidden
                className="inline-block h-0.5 w-3 rounded-full"
                style={{ backgroundColor: zoneColor(z === "unknown" ? undefined : z) }}
              />
              {z === "unknown" ? "Unknown" : z}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
