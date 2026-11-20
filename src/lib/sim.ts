import type { Edge } from '@xyflow/react';
import type { Breakpoint, Cfg, Finding, Kind, NodeStat, SimResult, Status, SysNode } from './types';

const num = (c: Cfg, k: string, d = 0) => {
  const v = Number(c[k]);
  return Number.isFinite(v) ? v : d;
};
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const pct = (x: number) => Math.round(x * 100);

export const fmt = (n: number) =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M'
  : n >= 1e4 ? (n / 1e3).toFixed(0) + 'k'
  : n >= 1e3 ? (n / 1e3).toFixed(1) + 'k'
  : n >= 10 ? String(Math.round(n))
  : n > 0 ? n.toFixed(1)
  : '0';

/** fração das LEITURAS que o nó absorve (CDN / cache) */
function absorb(kind: Kind, cfg: Cfg): number {
  if (kind === 'cdn') return clamp(num(cfg, 'hitPct') / 100, 0, 1);
  if (kind === 'cache') {
    const ws = num(cfg, 'workingSetGb');
    const cover = ws > 0 ? Math.min(1, num(cfg, 'ramGb') / ws) : 1;
    return clamp(num(cfg, 'hitPct') / 100, 0, 1) * cover;
  }
  return 0;
}

const HINT: Partial<Record<Kind, string>> = {
  cdn: 'a borda está no limite: aumente o plano/provedor ou o TTL para absorver mais.',
  loadbalancer: 'escale o balanceador horizontalmente (mais réplicas ou LB gerenciado).',
  gateway: 'escale o gateway horizontalmente ou cacheie respostas.',
  frontend: 'adicione instâncias ou aumente o cache (CDN / React Query no cliente).',
  backend: 'adicione instâncias, otimize o endpoint ou ponha um cache (Redis) na frente.',
  queue: 'aumente partições/throughput da fila.',
  storage: 'distribua em prefixos/buckets e ponha CDN na frente.',
  external: 'limite do provedor: use fila + worker, cache de respostas ou batching.',
  nosql: 'adicione shards ou revise a chave de partição (partição quente).',
};

type M = { util: number; base: number; note?: string; hint?: string };

function model(kind: Kind, cfg: Cfg, r: number, w: number): M {
  const t = r + w;
  const u = (cap: number) => (cap > 0 ? t / cap : t > 0 ? 9.99 : 0);
  switch (kind) {
    case 'cdn':
    case 'loadbalancer':
    case 'gateway':
    case 'queue':
    case 'storage':
    case 'external':
      return { util: u(num(cfg, 'maxRps')), base: num(cfg, 'latencyMs'), hint: HINT[kind] };
    case 'frontend':
    case 'backend': {
      const inst = num(cfg, 'instances');
      return { util: u(inst * num(cfg, 'rpsPerInstance')), base: num(cfg, 'latencyMs'), note: `${inst} instâncias`, hint: HINT[kind] };
    }
    case 'service': {
      const per = Math.max(1, num(cfg, 'rpsPerPod'));
      const tgt = clamp(num(cfg, 'targetCpuPct', 70) / 100, 0.1, 1);
      const min = Math.max(1, num(cfg, 'minPods', 1));
      const max = Math.max(min, num(cfg, 'maxPods', min));
      const pods = clamp(Math.ceil(t / (per * tgt)), min, max);
      const atMax = pods >= max && t > max * per * tgt;
      return {
        util: u(pods * per),
        base: num(cfg, 'latencyMs'),
        note: `HPA: ${pods}/${max} pods`,
        hint: atMax
          ? `o HPA chegou no máximo (${max} pods): aumente maxPods, otimize o serviço ou reduza a carga com cache.`
          : 'o HPA demora para criar pods: picos rápidos passam por saturação — aumente minPods.',
      };
    }
    case 'cache': {
      const ws = num(cfg, 'workingSetGb');
      const cover = ws > 0 ? Math.min(1, num(cfg, 'ramGb') / ws) : 1;
      return {
        util: u(num(cfg, 'maxRps')),
        base: num(cfg, 'latencyMs'),
        note: `RAM cobre ${pct(cover)}% dos dados quentes · hit ${pct(absorb(kind, cfg))}%`,
        hint: cover < 1
          ? 'RAM menor que os dados quentes: aumente a RAM ou reduza o que é cacheado (TTL/chaves).'
          : 'capacidade do cache no limite: use cluster com mais nós.',
      };
    }
    case 'worker': {
      const inst = num(cfg, 'instances');
      const cap = inst * num(cfg, 'jobsPerSec');
      return {
        util: u(cap),
        base: num(cfg, 'latencyMs'),
        note: t > cap ? `fila crescendo ${fmt(t - cap)} msg/s` : `${inst} workers`,
        hint: 'os consumidores não acompanham a fila (lag cresce): aumente workers, paralelismo ou processe em lote.',
      };
    }
    case 'nosql': {
      const sh = Math.max(1, num(cfg, 'shards'));
      return { util: u(sh * num(cfg, 'opsPerShard')), base: num(cfg, 'queryMs'), note: `${sh} shards`, hint: HINT.nosql };
    }
    case 'database': {
      const pool = Math.max(1, num(cfg, 'poolSize'));
      const rep = Math.max(0, num(cfg, 'replicas'));
      const ws = num(cfg, 'workingSetGb');
      const ramHit = ws > 0 ? Math.min(1, num(cfg, 'ramGb') / ws) : 1;
      const s = num(cfg, 'queryMs', 8) * (1 + 4 * (1 - ramHit)); // disco ~5x mais lento que RAM
      // trabalho em ms-de-conexão por segundo no primário: escrita custa 2x, leituras se dividem com as réplicas
      const work = w * 2 * s + (r * s) / (1 + rep);
      const hint =
        ramHit < 0.8
          ? `a RAM cobre só ${pct(ramHit)}% dos dados quentes: queries vão ao disco (~5× mais lentas). Aumente a RAM ou ponha Redis na frente.`
          : w * 2 > r / (1 + rep)
            ? 'escritas dominam: réplicas não ajudam. Use fila + worker, escrita em lote ou sharding.'
            : 'leituras dominam: adicione réplicas de leitura, cache (Redis/React Query) ou aumente o pool.';
      return {
        util: work / (pool * 1000),
        base: s,
        note: `RAM hit ${pct(ramHit)}% · pool ${pool}` + (rep ? ` · ${rep} réplica(s)` : ''),
        hint,
      };
    }
    default:
      return { util: 0, base: 0 };
  }
}

type Flow = { r: number; w: number; lat: number; async: boolean };
const weightOf = (e: Edge) => Math.max(0, Number(e.data?.weight ?? 1));

function run(nodes: SysNode[], edges: Edge[], mult: number, noDrop: boolean) {
  const byId = new Map(nodes.map((x) => [x.id, x]));
  const outs = new Map<string, Edge[]>();
  const deg = new Map<string, number>();
  nodes.forEach((x) => {
    outs.set(x.id, []);
    deg.set(x.id, 0);
  });
  edges.forEach((e) => {
    if (byId.has(e.source) && byId.has(e.target) && e.source !== e.target) {
      outs.get(e.source)!.push(e);
      deg.set(e.target, (deg.get(e.target) ?? 0) + 1);
    }
  });
  const order: string[] = [];
  const queue = nodes.filter((x) => !deg.get(x.id)).map((x) => x.id);
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const e of outs.get(id)!) {
      const d = (deg.get(e.target) ?? 0) - 1;
      deg.set(e.target, d);
      if (d === 0) queue.push(e.target);
    }
  }

  const fin = new Map<string, Flow>();
  nodes.forEach((x) => fin.set(x.id, { r: 0, w: 0, lat: 0, async: false }));
  const stats: Record<string, NodeStat> = {};
  const edgeRps: Record<string, number> = {};
  let offered = 0;
  let served = 0;
  let latSum = 0;

  for (const id of order) {
    const { kind, cfg, down } = byId.get(id)!.data;
    const inn = fin.get(id)!;
    const inTotal = inn.r + inn.w;
    let r = inn.r;
    let w = inn.w;
    let util = 0;
    let base = 0;
    let note: string | undefined;
    let hint: string | undefined;

    if (kind === 'users') {
      const raw = down ? 0 : (num(cfg, 'count') * num(cfg, 'reqPerMin') * mult) / 60;
      const reads = (raw * num(cfg, 'readPct', 90)) / 100;
      const saved = (reads * clamp(num(cfg, 'clientCachePct'), 0, 100)) / 100; // React Query: nem sai do navegador
      r = reads - saved;
      w = raw - reads;
      offered += r + w;
      if (saved > 0.05) note = `cache no cliente evita ${fmt(saved)} req/s`;
    } else {
      const m = model(kind, cfg, r, w);
      util = m.util;
      base = m.base;
      note = m.note;
      hint = m.hint;
      if (down) util = inTotal > 0 ? 9.99 : 0;
    }

    const drop = kind === 'users' || noDrop ? 0 : down ? 1 : util > 1 ? 1 - 1 / util : 0;
    if (kind !== 'users') {
      r *= 1 - drop;
      w *= 1 - drop;
    }

    if (kind === 'database') {
      const gbPerDay = (w * num(cfg, 'writeKb') * 86400) / 1e6;
      const left = num(cfg, 'storageGb') - num(cfg, 'usedGb');
      if (gbPerDay > 0) {
        const days = Math.max(0, left / gbPerDay);
        note += ` · disco cheio em ${days > 3650 ? '>10 anos' : Math.round(days) + ' dias'}`;
        if (days < 30) hint = `o disco enche em ${Math.round(days)} dias: aumente o armazenamento, arquive dados antigos ou reduza o tamanho das escritas.`;
      }
    }

    const lat = kind === 'users' ? 0 : base / (1 - Math.min(util, 0.97));
    const up = inTotal > 0 ? inn.lat / inTotal : 0;
    const path = up + lat;
    const total = r + w;
    const isAsync = inn.async;
    const out = outs.get(id)!;

    const hits = r * absorb(kind, cfg);
    const outR = r - hits;
    const sink = out.length === 0 && kind !== 'users';
    if (!isAsync) {
      if (sink || kind === 'queue') {
        served += total; // o caminho síncrono termina no último nó (ou no ack da fila)
        latSum += total * path;
      } else if (hits > 0) {
        served += hits;
        latSum += hits * path;
      }
    }

    const outTotal = outR + w;
    const split = out.filter((e) => !e.data?.fanout);
    const W = split.reduce((a, e) => a + weightOf(e), 0);
    for (const e of out) {
      const f = e.data?.fanout ? weightOf(e) : W > 0 ? weightOf(e) / W : 0;
      const t = fin.get(e.target)!;
      t.r += outR * f;
      t.w += w * f;
      t.lat += outTotal * f * path;
      t.async = t.async || isAsync || kind === 'queue';
      edgeRps[e.id] = outTotal * f;
    }

    let status: Status = util >= 1 ? 'bad' : util >= 0.75 ? 'warn' : 'ok';
    if (note && kind === 'database' && hint?.startsWith('o disco') && status === 'ok') status = 'warn';
    if (down) status = 'down';
    stats[id] = {
      inRps: kind === 'users' ? r + w : inTotal,
      outRps: outTotal,
      util,
      latencyMs: lat,
      dropPct: drop * 100,
      status,
      async: isAsync,
      note,
      hint: !down && (status === 'bad' || status === 'warn') ? hint : undefined,
    };
  }

  nodes.forEach((x) => {
    if (!stats[x.id])
      stats[x.id] = { inRps: 0, outRps: 0, util: 0, latencyMs: 0, dropPct: 0, status: x.data.down ? 'down' : 'ok', async: false };
  });
  return { stats, edgeRps, offered, served, latSum };
}

export function simulate(nodes: SysNode[], edges: Edge[], mult = 1): SimResult {
  const real = run(nodes, edges, mult, false);
  const ideal = run(nodes, edges, mult, true); // mesma carga, sem descartes: referência p/ calcular erros
  let bottleneckId: string | undefined;
  let worst = 0;
  nodes.forEach((x) => {
    const s = real.stats[x.id];
    if (x.data.kind !== 'users' && s.status !== 'down' && s.inRps > 0 && s.util > worst) {
      worst = s.util;
      bottleneckId = x.id;
    }
  });
  return {
    offered: real.offered,
    served: real.served,
    errorPct: ideal.served > 0 ? clamp(1 - real.served / ideal.served, 0, 1) * 100 : 0,
    avgLatencyMs: real.served > 0 ? real.latSum / real.served : 0,
    bottleneckId: worst >= 0.75 ? bottleneckId : undefined,
    stats: real.stats,
    edgeRps: real.edgeRps,
  };
}

/** varre o multiplicador de tráfego e acha o primeiro nó síncrono que satura */
export function findBreakpoint(nodes: SysNode[], edges: Edge[]): Breakpoint | null {
  for (let m = 0.05; m <= 3000; m *= 1.1) {
    const r = run(nodes, edges, m, false);
    let id: string | undefined;
    let worst = 0;
    for (const n of nodes) {
      const s = r.stats[n.id];
      if (n.data.kind === 'users' || s.status === 'down' || s.async) continue;
      if (s.util >= 1 && s.util > worst) {
        worst = s.util;
        id = n.id;
      }
    }
    if (id) return { mult: m, rps: r.offered, id };
  }
  return null;
}

export function diagnose(nodes: SysNode[], sim: SimResult): Finding[] {
  const out: (Finding & { u: number })[] = [];
  for (const n of nodes) {
    const s = sim.stats[n.id];
    const { kind, cfg, label } = n.data;
    if (kind === 'users' || s.inRps <= 0) continue;
    if (s.status === 'down') {
      out.push({ sev: 'bad', id: n.id, u: 99, text: `${label} está derrubado: ${fmt(s.inRps)} req/s falham. Teste redundância (réplicas, failover).` });
      continue;
    }
    if (s.util >= 1)
      out.push({ sev: 'bad', id: n.id, u: s.util, text: `${label} saturado (${pct(s.util)}%): ${s.async ? 'a fila acumula' : `descarta ${s.dropPct.toFixed(0)}%`}. ${s.hint ?? ''}` });
    else if (s.util >= 0.75)
      out.push({ sev: 'warn', id: n.id, u: s.util, text: `${label} com ${pct(s.util)}% de uso, perto do limite. ${s.hint ?? ''}` });
    else if (s.hint?.startsWith('o disco'))
      out.push({ sev: 'warn', id: n.id, u: 0.5, text: `${label}: ${s.hint}` });

    if (kind === 'database' && num(cfg, 'replicas') < 1)
      out.push({ sev: 'info', id: n.id, u: 0, text: `${label} não tem réplica: é ponto único de falha.` });
    if ((kind === 'frontend' || kind === 'backend' || kind === 'worker') && num(cfg, 'instances') < 2)
      out.push({ sev: 'info', id: n.id, u: 0, text: `${label} tem 1 instância: ponto único de falha.` });
    if (kind === 'service' && num(cfg, 'minPods') < 2)
      out.push({ sev: 'info', id: n.id, u: 0, text: `${label} com minPods < 2: sem redundância e o HPA começa do zero em picos.` });
  }
  const rank = { bad: 0, warn: 1, info: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev] || b.u - a.u).map(({ u: _u, ...f }) => f);
}
