import type { Node } from '@xyflow/react';

export type Kind =
  | 'users' | 'cdn' | 'loadbalancer' | 'gateway' | 'frontend' | 'backend' | 'service'
  | 'cache' | 'queue' | 'worker' | 'database' | 'nosql' | 'storage' | 'external';
export type Cfg = Record<string, number | string>;
export type Status = 'ok' | 'warn' | 'bad' | 'down';

export type NodeStat = {
  inRps: number;
  outRps: number;
  util: number;
  latencyMs: number;
  dropPct: number;
  status: Status;
  async: boolean;
  note?: string;
  hint?: string;
};

export type SysData = {
  kind: Kind;
  label: string;
  down?: boolean;
  cfg: Cfg;
  stat?: NodeStat;
};

export type SysNode = Node<SysData, 'sys'>;

export type SimResult = {
  offered: number;
  served: number;
  errorPct: number;
  avgLatencyMs: number;
  bottleneckId?: string;
  stats: Record<string, NodeStat>;
  edgeRps: Record<string, number>;
};

export type Finding = { sev: 'bad' | 'warn' | 'info'; id: string; text: string };
export type Breakpoint = { mult: number; rps: number; id: string };
