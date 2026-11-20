'use client';
import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { CATALOG } from '@/lib/catalog';
import { fmt } from '@/lib/sim';
import type { SysData } from '@/lib/types';

export default function SystemNode({ data, selected }: NodeProps<Node<SysData, 'sys'>>) {
  const c = CATALOG[data.kind];
  const Icon = c.icon;
  const s = data.stat;
  const status = s?.status ?? 'ok';
  const util = s ? Math.min(s.util, 1) : 0;
  const badge =
    status === 'down' ? 'DERRUBADO'
    : status === 'bad' ? (s?.async ? 'LAG' : 'SATURADO')
    : status === 'warn' ? 'ATENÇÃO'
    : '';
  const engine = data.cfg.engine ? ` · ${data.cfg.engine}` : '';

  return (
    <div className={`sys-node ${status} ${selected ? 'sel' : ''}`}>
      {data.kind !== 'users' && <Handle type="target" position={Position.Left} />}
      <div className="sys-head">
        <span className="pal-ico" style={{ background: c.color }}>
          <Icon size={16} />
        </span>
        <div className="sys-titles">
          <div className="sys-title">{data.label}</div>
          <div className="sys-kind">
            {c.label}
            {engine}
          </div>
        </div>
        {badge && <span className={`badge ${status}`}>{badge}</span>}
      </div>
      {status === 'down' ? (
        <div className="sys-line">sem resposta · {fmt(s?.inRps ?? 0)} req/s falhando</div>
      ) : data.kind === 'users' ? (
        <>
          <div className="sys-line">
            <b>{fmt(s?.inRps ?? 0)}</b> req/s na rede
          </div>
          {s?.note && <div className="sys-note">{s.note}</div>}
        </>
      ) : (
        <>
          <div className="bar">
            <div style={{ width: `${util * 100}%` }} />
          </div>
          <div className="sys-line">
            <b>{fmt(s?.inRps ?? 0)}</b> req/s · uso {s && s.util > 9 ? '>900' : Math.round((s?.util ?? 0) * 100)}% · {Math.round(s?.latencyMs ?? 0)} ms
          </div>
          {s && s.dropPct > 0.5 && !s.async && <div className="sys-line bad">descarta {s.dropPct.toFixed(0)}%</div>}
          {s?.note && <div className="sys-note">{s.note}</div>}
        </>
      )}
      {data.kind !== 'database' && data.kind !== 'nosql' && data.kind !== 'storage' && data.kind !== 'external' && (
        <Handle type="source" position={Position.Right} />
      )}
    </div>
  );
}
