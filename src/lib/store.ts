import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type NodeChange,
} from '@xyflow/react';
import { CATALOG } from './catalog';
import { PRESETS } from './presets';
import type { Kind, SysNode } from './types';

type State = {
  nodes: SysNode[];
  edges: Edge[];
  mult: number; // multiplicador de tráfego (não persiste)
  running: boolean; // partículas animadas (não persiste)
  onNodesChange: (c: NodeChange<SysNode>[]) => void;
  onEdgesChange: (c: EdgeChange[]) => void;
  onConnect: (c: Connection) => void;
  addNode: (k: Kind) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  select: (id: string) => void;
  patchNode: (id: string, patch: { label?: string; down?: boolean }) => void;
  setCfg: (id: string, key: string, value: number | string) => void;
  setEdge: (id: string, patch: { weight?: number; fanout?: boolean }) => void;
  setMult: (m: number) => void;
  setRunning: (r: boolean) => void;
  loadPreset: (name: string) => void;
  reset: () => void;
  exportJson: () => string;
  importJson: (text: string) => boolean;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...PRESETS.basico.build(),
      mult: 1,
      running: true,
      onNodesChange: (c) => set({ nodes: applyNodeChanges(c, get().nodes) }),
      onEdgesChange: (c) => set({ edges: applyEdgeChanges(c, get().edges) }),
      onConnect: (c) => set({ edges: addEdge({ ...c, data: { weight: 1, fanout: false } }, get().edges) }),
      addNode: (k) => {
        const len = get().nodes.length;
        const id = `${k}-${Math.random().toString(36).slice(2, 7)}`;
        const node: SysNode = {
          id,
          type: 'sys',
          position: { x: 60 + (len % 4) * 290, y: 420 + Math.floor(len / 4) * 60 },
          data: { kind: k, label: CATALOG[k].label, cfg: { ...CATALOG[k].defaults } },
        };
        set({ nodes: [...get().nodes, node] });
      },
      removeNode: (id) =>
        set({
          nodes: get().nodes.filter((n) => n.id !== id),
          edges: get().edges.filter((e) => e.source !== id && e.target !== id),
        }),
      removeEdge: (id) => set({ edges: get().edges.filter((e) => e.id !== id) }),
      select: (id) =>
        set({
          nodes: get().nodes.map((n) => ({ ...n, selected: n.id === id })),
          edges: get().edges.map((e) => ({ ...e, selected: false })),
        }),
      patchNode: (id, patch) =>
        set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)) }),
      setCfg: (id, key, value) =>
        set({
          nodes: get().nodes.map((n) =>
            n.id === id ? { ...n, data: { ...n.data, cfg: { ...n.data.cfg, [key]: value } } } : n,
          ),
        }),
      setEdge: (id, patch) =>
        set({ edges: get().edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)) }),
      setMult: (mult) => set({ mult }),
      setRunning: (running) => set({ running }),
      loadPreset: (name) => {
        const p = PRESETS[name];
        if (p) set({ ...p.build(), mult: 1 });
      },
      reset: () => set({ nodes: [], edges: [], mult: 1 }),
      exportJson: () => JSON.stringify({ nodes: get().nodes, edges: get().edges }, null, 2),
      importJson: (text) => {
        try {
          const j = JSON.parse(text);
          if (!Array.isArray(j.nodes) || !Array.isArray(j.edges)) return false;
          set({ nodes: j.nodes, edges: j.edges, mult: 1 });
          return true;
        } catch {
          return false;
        }
      },
    }),
    {
      name: 'scale-lab:v1',
      partialize: (s) => ({ nodes: s.nodes, edges: s.edges }),
    },
  ),
);
