import type { GraphEdge } from './types';

// BFS: el recurso y todo lo que depende de él, directa o indirectamente
export function dependents(edges: GraphEdge[], start: string): Set<string> {
  const next = new Map<string, string[]>();
  for (const e of edges) next.set(e.from, [...(next.get(e.from) ?? []), e.to]);
  const seen = new Set<string>([start]);
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const n of next.get(cur) ?? []) {
      if (!seen.has(n)) { seen.add(n); queue.push(n); }
    }
  }
  return seen;
}