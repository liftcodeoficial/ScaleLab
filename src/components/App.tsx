'use client';
import { useMemo, useRef } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { CATALOG, GROUPS } from '@/lib/catalog';
import { diagnose, findBreakpoint, simulate } from '@/lib/sim';
import { PRESETS } from '@/lib/presets';
import { useStore } from '@/lib/store';
import Canvas from './Canvas';
import Inspector from './Inspector';

export default function App() {
  const nodes = useStore((s) => s.nodes);
  const edges = useStore((s) => s.edges);
  const mult = useStore((s) => s.mult);
  const addNode = useStore((s) => s.addNode);
  const loadPreset = useStore((s) => s.loadPreset);
  const reset = useStore((s) => s.reset);
  const exportJson = useStore((s) => s.exportJson);
  const importJson = useStore((s) => s.importJson);
  const fileRef = useRef<HTMLInputElement>(null);

  const sim = useMemo(() => simulate(nodes, edges, mult), [nodes, edges, mult]);
  const findings = useMemo(() => diagnose(nodes, sim), [nodes, sim]);
  // a varredura de capacidade só depende da estrutura/configuração, não das posições
  const structKey = JSON.stringify([
    nodes.map((n) => [n.id, n.data.kind, n.data.down, n.data.cfg]),
    edges.map((e) => [e.id, e.source, e.target, e.data]),
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bp = useMemo(() => findBreakpoint(nodes, edges), [structKey]);

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportJson()], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'scale-lab.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (f?: File) => {
    if (!f) return;
    if (!importJson(await f.text())) alert('Arquivo inválido.');
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="shell">
      <header className="top">
        <h1>Scale Lab</h1>
        <div className="actions">
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) loadPreset(e.target.value);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              Exemplos…
            </option>
            {Object.entries(PRESETS).map(([k, p]) => (
              <option key={k} value={k}>
                {p.label}
              </option>
            ))}
          </select>
          <button onClick={download}>Exportar</button>
          <button onClick={() => fileRef.current?.click()}>Importar</button>
          <button onClick={() => confirm('Limpar o diagrama?') && reset()}>Limpar</button>
          <input ref={fileRef} type="file" accept="application/json" hidden onChange={(e) => onFile(e.target.files?.[0])} />
        </div>
      </header>
      <aside className="palette">
        {GROUPS.map((g) => (
          <div key={g.title} className="pal-group">
            <h2>{g.title}</h2>
            {g.kinds.map((k) => {
              const Icon = CATALOG[k].icon;
              return (
                <button key={k} className="pal-item" onClick={() => addNode(k)}>
                  <span className="pal-ico" style={{ background: CATALOG[k].color }}>
                    <Icon size={16} />
                  </span>
                  {CATALOG[k].label}
                </button>
              );
            })}
          </div>
        ))}
        <p className="hint">
          Clique para adicionar. Arraste da bolinha direita de um nó até a esquerda de outro para conectar. Clique numa seta para editar peso ou fan-out. Delete remove o selecionado.
        </p>
      </aside>
      <main className="main">
        <ReactFlowProvider>
          <Canvas sim={sim} bp={bp} />
        </ReactFlowProvider>
      </main>
      <Inspector findings={findings} />
    </div>
  );
}
