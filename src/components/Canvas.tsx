'use client';
import { useEffect, useMemo, useState } from 'react';
import { Background, Controls, MarkerType, Panel, ReactFlow, type Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { fmt } from '@/lib/sim';
import { useStore } from '@/lib/store';
import type { Breakpoint, SimResult } from '@/lib/types';
import SystemNode from './SystemNode';
import TrafficEdge from './TrafficEdge';

const nodeTypes = { sys: SystemNode };
const edgeTypes = { traffic: TrafficEdge };
const COLOR = { ok: '#5a9e3a', warn: '#e8963a', bad: '#e5484d', down: '#e5484d' };

export default function Canvas({ sim, bp }: { sim: SimResult; bp: Breakpoint | null }) {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const mult = useStore((s) => s.mult);
  const running = useStore((s) => s.running);
  const onNodesChange = useStore((s) => s.onNodesChange);
  const onEdgesChange = useStore((s) => s.onEdgesChange);
  const onConnect = useStore((s) => s.onConnect);
  const setMult = useStore((s) => s.setMult);
  const setRunning = useStore((s) => s.setRunning);
  const [ramping, setRamping] = useState(false);

  // rampa de carga: 1× → 100× em 25 s (escala logarítmica)
  useEffect(() => {
    if (!ramping) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / 25000);
      setMult(Math.pow(100, p));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setRamping(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ramping, setMult]);

  const viewNodes = useMemo(
    () => nodes.map((n) => ({ ...n, data: { ...n.data, stat: sim.stats[n.id] } })),
    [nodes, sim],
  );

  const viewEdges: Edge[] = useMemo(
    () =>
      edges.map((e) => {
        const rps = sim.edgeRps[e.id] ?? 0;
        const t = sim.stats[e.target];
        const color = rps > 0 ? COLOR[t?.status ?? 'ok'] : '#b9b2a0';
        return {
          ...e,
          type: 'traffic',
          data: { ...e.data, rps, color, dropPct: t?.dropPct ?? 0, running },
          markerEnd: { type: MarkerType.ArrowClosed, color },
        };
      }),
    [edges, sim, running],
  );

  const bn = bp ? nodes.find((n) => n.id === bp.id)?.data.label : undefined;
  const over = bp ? sim.offered > bp.rps : false;
  const multTxt = mult < 10 ? mult.toFixed(1) : String(Math.round(mult));

  return (
    <ReactFlow
      nodes={viewNodes}
      edges={viewEdges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      deleteKeyCode={['Backspace', 'Delete']}
      minZoom={0.2}
      fitView
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={24} color="#d8cfb8" />
      <Controls showInteractive={false} />
      <Panel position="top-left">
        <div className="metrics">
          <div className="metric">
            <span>REQ/S NA REDE {mult !== 1 && `· ${multTxt}×`}</span>
            <b>{fmt(sim.offered)}</b>
          </div>
          <div className={`metric ${sim.avgLatencyMs > 1000 ? 'bad' : sim.avgLatencyMs > 300 ? 'warn' : ''}`}>
            <span>LATÊNCIA MÉDIA</span>
            <b>{sim.avgLatencyMs.toFixed(0)} ms</b>
          </div>
          <div className={`metric ${sim.errorPct > 1 ? 'bad' : ''}`}>
            <span>ERROS</span>
            <b>{sim.errorPct.toFixed(1)}%</b>
          </div>
          <div className={`metric wide ${over ? 'bad' : ''}`}>
            <span>AGUENTA ATÉ</span>
            <b>{bp ? `${fmt(bp.rps)} req/s` : 'sem limite'}</b>
            {bn && (
              <small>
                gargalo: {bn} · {bp!.mult < 1 ? bp!.mult.toFixed(2) : bp!.mult.toFixed(1)}× o tráfego atual
              </small>
            )}
          </div>
        </div>
      </Panel>
      <Panel position="top-right">
        <div className="mult">
          <span>TRÁFEGO</span>
          <input
            type="range"
            min={0}
            max={100}
            step={0.5}
            value={Math.log10(Math.max(1, mult)) * 50}
            onChange={(e) => {
              setRamping(false);
              setMult(Math.pow(10, Number(e.target.value) / 50));
            }}
          />
          <b>{multTxt}×</b>
          <button className={ramping ? 'on' : ''} onClick={() => setRamping(!ramping)}>
            {ramping ? '■ Parar rampa' : '▶ Rampa 1→100×'}
          </button>
          <button onClick={() => { setRamping(false); setMult(1); }}>1×</button>
          <button className={running ? 'on' : ''} onClick={() => setRunning(!running)}>
            {running ? '❚❚ Pausar' : '▶ Rodar'}
          </button>
        </div>
      </Panel>
    </ReactFlow>
  );
}
