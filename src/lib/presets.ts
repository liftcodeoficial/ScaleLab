import type { Edge } from '@xyflow/react';
import { CATALOG } from './catalog';
import type { Cfg, Kind, SysNode } from './types';

const N = (id: string, kind: Kind, x: number, y: number, label?: string, cfg: Cfg = {}): SysNode => ({
  id,
  type: 'sys',
  position: { x, y },
  data: { kind, label: label ?? CATALOG[kind].label, cfg: { ...CATALOG[kind].defaults, ...cfg } },
});
const E = (id: string, source: string, target: string, weight = 1, fanout = false): Edge => ({
  id,
  source,
  target,
  data: { weight, fanout },
});

const DISK: Cfg = { storageGb: 2000, usedGb: 300, writeKb: 1 };

export type Graph = { nodes: SysNode[]; edges: Edge[] };

export const PRESETS: Record<string, { label: string; build: () => Graph }> = {
  basico: {
    label: 'Monólito simples (1 banco)',
    build: () => ({
      nodes: [
        N('u', 'users', 0, 120, 'Clientes', { count: 200000, reqPerMin: 0.5, clientCachePct: 0 }),
        N('lb', 'loadbalancer', 290, 120, 'Nginx'),
        N('api', 'backend', 580, 120, 'API monolito', { instances: 3 }),
        N('db', 'database', 870, 120, 'PostgreSQL', DISK),
      ],
      edges: [E('e1', 'u', 'lb'), E('e2', 'lb', 'api'), E('e3', 'api', 'db')],
    }),
  },
  otimizado: {
    label: 'Com CDN, Redis e réplica',
    build: () => ({
      nodes: [
        N('u', 'users', 0, 140, 'Clientes', { count: 200000, reqPerMin: 0.5, clientCachePct: 60 }),
        N('cdn', 'cdn', 280, 140),
        N('lb', 'loadbalancer', 560, 140, 'Nginx'),
        N('gw', 'gateway', 840, 140),
        N('api', 'backend', 1120, 140, 'API', { instances: 4 }),
        N('rd', 'cache', 1400, 140, 'Redis', { ramGb: 8, workingSetGb: 8 }),
        N('db', 'database', 1680, 140, 'PostgreSQL', { ...DISK, ramGb: 16, workingSetGb: 16, poolSize: 40, replicas: 1 }),
      ],
      edges: [E('e1', 'u', 'cdn'), E('e2', 'cdn', 'lb'), E('e3', 'lb', 'gw'), E('e4', 'gw', 'api'), E('e5', 'api', 'rd'), E('e6', 'rd', 'db')],
    }),
  },
  micro: {
    label: 'Microserviços + fila + K8s',
    build: () => ({
      nodes: [
        N('u', 'users', 0, 280, 'Clientes', { count: 400000, reqPerMin: 0.6, clientCachePct: 60 }),
        N('cdn', 'cdn', 270, 280),
        N('lb', 'loadbalancer', 540, 280, 'Nginx Ingress'),
        N('gw', 'gateway', 810, 280),
        N('cat', 'service', 1080, 100, 'Serviço Catálogo', { minPods: 2, maxPods: 8, rpsPerPod: 200 }),
        N('ped', 'service', 1080, 460, 'Serviço Pedidos', { minPods: 2, maxPods: 6, rpsPerPod: 150 }),
        N('rd', 'cache', 1350, 100, 'Redis catálogo', { ramGb: 4, workingSetGb: 4 }),
        N('nosql', 'nosql', 1620, 100, 'Catálogo (Mongo)'),
        N('q', 'queue', 1350, 400, 'Fila de pedidos'),
        N('wk', 'worker', 1620, 400, 'Worker pedidos', { instances: 3, jobsPerSec: 120 }),
        N('db', 'database', 1890, 400, 'Pedidos (Postgres)', { ...DISK, ramGb: 16, workingSetGb: 16, poolSize: 30 }),
        N('pay', 'external', 1350, 560, 'Gateway de pagamento'),
      ],
      edges: [
        E('e1', 'u', 'cdn'),
        E('e2', 'cdn', 'lb'),
        E('e3', 'lb', 'gw'),
        E('e4', 'gw', 'cat', 3),
        E('e5', 'gw', 'ped', 1),
        E('e6', 'cat', 'rd'),
        E('e7', 'rd', 'nosql'),
        E('e8', 'ped', 'q', 1, true),
        E('e9', 'ped', 'pay', 1, true),
        E('e10', 'q', 'wk'),
        E('e11', 'wk', 'db'),
      ],
    }),
  },
};
