import {
  Boxes, Cloud, Cog, Database, DatabaseZap, Globe, HardDrive, ListOrdered, Monitor, Network, Server, Split, Users, Zap,
  type LucideIcon,
} from 'lucide-react';
import type { Cfg, Kind } from './types';

export type Field = {
  key: string;
  label: string;
  type: 'number' | 'select';
  min?: number;
  step?: number;
  unit?: string;
  options?: string[];
};

type Def = { label: string; icon: LucideIcon; color: string; defaults: Cfg; fields: Field[] };

const rps = (key: string, label: string, step = 100): Field => ({ key, label, type: 'number', min: 1, step, unit: 'req/s' });
const lat = (label = 'Latência base'): Field => ({ key: 'latencyMs', label, type: 'number', min: 0, step: 1, unit: 'ms' });
const engine = (options: string[]): Field => ({ key: 'engine', label: 'Tecnologia', type: 'select', options });

export const CATALOG: Record<Kind, Def> = {
  users: {
    label: 'Clientes',
    icon: Users,
    color: '#f6d9b8',
    defaults: { count: 50000, reqPerMin: 2, readPct: 90, clientCachePct: 40 },
    fields: [
      { key: 'count', label: 'Usuários ativos', type: 'number', min: 0, step: 1000 },
      { key: 'reqPerMin', label: 'Requisições por usuário', type: 'number', min: 0, step: 0.5, unit: 'req/min' },
      { key: 'readPct', label: 'Proporção de leitura (GET)', type: 'number', min: 0, step: 5, unit: '%' },
      { key: 'clientCachePct', label: 'Cache no cliente (React Query): leituras que nem saem do navegador', type: 'number', min: 0, step: 5, unit: '%' },
    ],
  },
  cdn: {
    label: 'CDN',
    icon: Globe,
    color: '#d9d2f5',
    defaults: { hitPct: 70, maxRps: 200000, latencyMs: 15 },
    fields: [
      { key: 'hitPct', label: 'Leituras servidas pela borda', type: 'number', min: 0, step: 5, unit: '%' },
      rps('maxRps', 'Capacidade', 10000),
      lat('Latência'),
    ],
  },
  loadbalancer: {
    label: 'Load Balancer',
    icon: Network,
    color: '#d9d2f5',
    defaults: { engine: 'Nginx', maxRps: 20000, latencyMs: 1 },
    fields: [engine(['Nginx', 'HAProxy', 'Traefik', 'AWS ALB']), rps('maxRps', 'Capacidade', 1000), lat()],
  },
  gateway: {
    label: 'API Gateway',
    icon: Split,
    color: '#d9d2f5',
    defaults: { maxRps: 10000, latencyMs: 5 },
    fields: [rps('maxRps', 'Capacidade / rate limit', 500), lat('Latência (auth, roteamento)')],
  },
  frontend: {
    label: 'Frontend (SSR)',
    icon: Monitor,
    color: '#cfe0f7',
    defaults: { instances: 2, rpsPerInstance: 300, latencyMs: 20 },
    fields: [
      { key: 'instances', label: 'Instâncias', type: 'number', min: 1, step: 1 },
      rps('rpsPerInstance', 'Capacidade por instância', 50),
      lat(),
    ],
  },
  backend: {
    label: 'Backend (API)',
    icon: Server,
    color: '#cfe0f7',
    defaults: { instances: 4, rpsPerInstance: 500, latencyMs: 30 },
    fields: [
      { key: 'instances', label: 'Instâncias', type: 'number', min: 1, step: 1 },
      rps('rpsPerInstance', 'Capacidade por instância', 50),
      lat(),
    ],
  },
  service: {
    label: 'Microserviço (K8s)',
    icon: Boxes,
    color: '#cfe0f7',
    defaults: { minPods: 2, maxPods: 10, rpsPerPod: 200, targetCpuPct: 70, latencyMs: 25 },
    fields: [
      { key: 'minPods', label: 'Pods mínimos (HPA)', type: 'number', min: 1, step: 1 },
      { key: 'maxPods', label: 'Pods máximos (HPA)', type: 'number', min: 1, step: 1 },
      rps('rpsPerPod', 'Capacidade por pod', 50),
      { key: 'targetCpuPct', label: 'Meta de CPU do HPA', type: 'number', min: 10, step: 5, unit: '%' },
      lat(),
    ],
  },
  cache: {
    label: 'Cache (Redis)',
    icon: Zap,
    color: '#fbe7a1',
    defaults: { hitPct: 90, ramGb: 4, workingSetGb: 8, maxRps: 80000, latencyMs: 1 },
    fields: [
      { key: 'hitPct', label: 'Acerto máximo (se tudo couber na RAM)', type: 'number', min: 0, step: 5, unit: '%' },
      { key: 'ramGb', label: 'RAM', type: 'number', min: 0.5, step: 1, unit: 'GB' },
      { key: 'workingSetGb', label: 'Dados quentes', type: 'number', min: 0.1, step: 1, unit: 'GB' },
      rps('maxRps', 'Capacidade', 5000),
      lat('Latência'),
    ],
  },
  queue: {
    label: 'Fila (Kafka/SQS)',
    icon: ListOrdered,
    color: '#fbe7a1',
    defaults: { engine: 'Kafka', maxRps: 50000, latencyMs: 5 },
    fields: [engine(['Kafka', 'RabbitMQ', 'SQS', 'Redis Streams']), rps('maxRps', 'Throughput', 5000), lat('Latência do ack')],
  },
  worker: {
    label: 'Worker (assíncrono)',
    icon: Cog,
    color: '#fbe7a1',
    defaults: { instances: 2, jobsPerSec: 50, latencyMs: 100 },
    fields: [
      { key: 'instances', label: 'Instâncias', type: 'number', min: 1, step: 1 },
      { key: 'jobsPerSec', label: 'Jobs por instância', type: 'number', min: 1, step: 10, unit: 'jobs/s' },
      lat('Tempo por job'),
    ],
  },
  database: {
    label: 'Banco SQL',
    icon: Database,
    color: '#f3c6c6',
    defaults: { engine: 'PostgreSQL', poolSize: 20, ramGb: 4, workingSetGb: 16, storageGb: 100, usedGb: 40, queryMs: 8, writeKb: 4, replicas: 0 },
    fields: [
      engine(['PostgreSQL', 'MySQL', 'SQL Server', 'Outro']),
      { key: 'poolSize', label: 'Pool de conexões', type: 'number', min: 1, step: 5, unit: 'conexões' },
      { key: 'ramGb', label: 'RAM', type: 'number', min: 0.5, step: 1, unit: 'GB' },
      { key: 'workingSetGb', label: 'Dados quentes (working set)', type: 'number', min: 0.1, step: 1, unit: 'GB' },
      { key: 'storageGb', label: 'Armazenamento', type: 'number', min: 1, step: 10, unit: 'GB' },
      { key: 'usedGb', label: 'Já usado', type: 'number', min: 0, step: 5, unit: 'GB' },
      { key: 'queryMs', label: 'Tempo médio da query (em RAM)', type: 'number', min: 0.1, step: 1, unit: 'ms' },
      { key: 'writeKb', label: 'Tamanho médio de escrita', type: 'number', min: 0, step: 1, unit: 'KB' },
      { key: 'replicas', label: 'Réplicas de leitura', type: 'number', min: 0, step: 1 },
    ],
  },
  nosql: {
    label: 'NoSQL',
    icon: DatabaseZap,
    color: '#f3c6c6',
    defaults: { engine: 'MongoDB', shards: 3, opsPerShard: 3000, queryMs: 5 },
    fields: [
      engine(['MongoDB', 'DynamoDB', 'Cassandra', 'Outro']),
      { key: 'shards', label: 'Shards / nós', type: 'number', min: 1, step: 1 },
      { key: 'opsPerShard', label: 'Capacidade por shard', type: 'number', min: 1, step: 500, unit: 'ops/s' },
      { key: 'queryMs', label: 'Latência por operação', type: 'number', min: 0.1, step: 1, unit: 'ms' },
    ],
  },
  storage: {
    label: 'Storage (S3)',
    icon: HardDrive,
    color: '#f3c6c6',
    defaults: { maxRps: 5500, latencyMs: 40 },
    fields: [rps('maxRps', 'Requisições', 500), lat('Latência')],
  },
  external: {
    label: 'API externa',
    icon: Cloud,
    color: '#d6e9d0',
    defaults: { maxRps: 400, latencyMs: 300 },
    fields: [rps('maxRps', 'Rate limit do provedor', 50), lat('Latência do provedor')],
  },
};

export const GROUPS: { title: string; kinds: Kind[] }[] = [
  { title: 'Entrada', kinds: ['users'] },
  { title: 'Borda e rede', kinds: ['cdn', 'loadbalancer', 'gateway'] },
  { title: 'Computação', kinds: ['frontend', 'backend', 'service'] },
  { title: 'Cache e assíncrono', kinds: ['cache', 'queue', 'worker'] },
  { title: 'Dados', kinds: ['database', 'nosql', 'storage'] },
  { title: 'Externo', kinds: ['external'] },
];
