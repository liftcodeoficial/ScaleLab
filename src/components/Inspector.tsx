'use client';
import { CATALOG } from '@/lib/catalog';
import { useStore } from '@/lib/store';
import type { Finding } from '@/lib/types';

export default function Inspector({ findings }: { findings: Finding[] }) {
  const node = useStore((s) => s.nodes.find((n) => n.selected));
  const edge = useStore((s) => s.edges.find((e) => e.selected));
  const patchNode = useStore((s) => s.patchNode);
  const setCfg = useStore((s) => s.setCfg);
  const removeNode = useStore((s) => s.removeNode);
  const setEdge = useStore((s) => s.setEdge);
  const removeEdge = useStore((s) => s.removeEdge);
  const select = useStore((s) => s.select);

  return (
    <aside className="inspector">
      {node ? (
        <>
          <h2>{CATALOG[node.data.kind].label}</h2>
          <label className="field">
            <span>Nome</span>
            <input value={node.data.label} onChange={(e) => patchNode(node.id, { label: e.target.value })} />
          </label>
          {CATALOG[node.data.kind].fields.map((f) => (
            <label className="field" key={f.key}>
              <span>
                {f.label}
                {f.unit ? ` (${f.unit})` : ''}
              </span>
              {f.type === 'select' ? (
                <select value={String(node.data.cfg[f.key] ?? '')} onChange={(e) => setCfg(node.id, f.key, e.target.value)}>
                  {f.options!.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  min={f.min}
                  step={f.step}
                  value={Number(node.data.cfg[f.key] ?? 0)}
                  onChange={(e) => setCfg(node.id, f.key, e.target.value === '' ? 0 : Number(e.target.value))}
                />
              )}
            </label>
          ))}
          <div className="row">
            <button onClick={() => patchNode(node.id, { down: !node.data.down })}>{node.data.down ? 'Reativar' : 'Derrubar'}</button>
            <button className="danger" onClick={() => removeNode(node.id)}>
              Remover
            </button>
          </div>
        </>
      ) : edge ? (
        <>
          <h2>Conexão</h2>
          <label className="field">
            <span>{edge.data?.fanout ? 'Chamadas por requisição' : 'Peso do split (relativo aos irmãos)'}</span>
            <input
              type="number"
              min={0}
              step={edge.data?.fanout ? 0.1 : 1}
              value={Number(edge.data?.weight ?? 1)}
              onChange={(e) => setEdge(edge.id, { weight: Number(e.target.value) })}
            />
          </label>
          <label className="check">
            <input type="checkbox" checked={Boolean(edge.data?.fanout)} onChange={(e) => setEdge(edge.id, { fanout: e.target.checked })} />
            Fan-out: toda requisição chama este destino (além dos outros)
          </label>
          <p className="hint">Sem fan-out, as saídas de um nó dividem o tráfego pelo peso (ex.: 3 e 1 = 75% / 25%).</p>
          <div className="row">
            <button className="danger" onClick={() => removeEdge(edge.id)}>
              Remover conexão
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Propriedades</h2>
          <p className="hint">Selecione um nó ou uma seta para editar. Use a rampa de tráfego ou o slider para achar o gargalo e depois ajuste pool, RAM, pods, cache ou réplicas.</p>
        </>
      )}

      <h2 className="diag-title">Diagnóstico</h2>
      {findings.length === 0 ? (
        <p className="hint">Nenhum problema com a carga atual.</p>
      ) : (
        <ul className="findings">
          {findings.map((f, i) => (
            <li key={i} className={f.sev} onClick={() => select(f.id)}>
              {f.text}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
