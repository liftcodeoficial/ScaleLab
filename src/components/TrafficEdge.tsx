'use client';
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import { fmt } from '@/lib/sim';

type D = { rps?: number; color?: string; dropPct?: number; running?: boolean; fanout?: boolean; weight?: number };

export default function TrafficEdge(p: EdgeProps) {
  const d = (p.data ?? {}) as D;
  const [path, lx, ly] = getSmoothStepPath({
    sourceX: p.sourceX,
    sourceY: p.sourceY,
    targetX: p.targetX,
    targetY: p.targetY,
    sourcePosition: p.sourcePosition,
    targetPosition: p.targetPosition,
    borderRadius: 14,
  });
  const rps = d.rps ?? 0;
  const color = d.color ?? '#b9b2a0';
  const width = rps > 0 ? Math.min(7, 1.5 + Math.log10(rps + 1)) : 1.5;
  // quantidade de "pacotes" cresce com o log do tráfego
  const n = rps > 0 && d.running ? Math.max(2, Math.min(14, Math.round(2 + Math.log10(rps + 1) * 2.2))) : 0;
  const dead = Math.round(n * Math.min(1, (d.dropPct ?? 0) / 100)); // pacotes que morrem antes de chegar
  const dur = 2.4;

  return (
    <>
      <BaseEdge
        id={p.id}
        path={path}
        markerEnd={p.markerEnd}
        interactionWidth={24}
        style={{ stroke: color, strokeWidth: width, opacity: p.selected ? 1 : 0.5 }}
      />
      {Array.from({ length: n }).map((_, i) => {
        const begin = `${-(i * dur) / n}s`;
        return i < dead ? (
          <circle key={i} r={3.5} fill="#e5484d">
            <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite" path={path} keyPoints="0;0.8" keyTimes="0;1" calcMode="linear" />
            <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.6;0.85;1" dur={`${dur}s`} begin={begin} repeatCount="indefinite" />
          </circle>
        ) : (
          <circle key={i} r={3.5} fill={color}>
            <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite" path={path} />
          </circle>
        );
      })}
      <EdgeLabelRenderer>
        <div
          className={`edge-label nodrag nopan ${p.selected ? 'sel' : ''}`}
          style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}
        >
          {fmt(rps)} req/s
          {d.fanout ? ` · ⑂×${d.weight ?? 1}` : ''}
          {(d.dropPct ?? 0) > 0.5 ? <b> · −{(d.dropPct ?? 0).toFixed(0)}%</b> : null}
        </div>
      </EdgeLabelRenderer>
    </>
  );
}
