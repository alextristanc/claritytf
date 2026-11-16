import type { GraphModel } from './types';

export function layout(model: GraphModel) {
  const level = new Map<string, number>();
  model.nodes.forEach(n => level.set(n.id, 0));
  for (let i = 0; i < model.nodes.length; i++) {
    let changed = false;
    for (const e of model.edges) {
      const l = (level.get(e.from) ?? 0) + 1;
      if (l > (level.get(e.to) ?? 0)) { level.set(e.to, l); changed = true; }
    }
    if (!changed) break;
  }
  const rows = new Map<number, number>();
  const pos = new Map<string, { x: number; y: number }>();
  for (const n of model.nodes) {
    const l = level.get(n.id) ?? 0;
    const r = rows.get(l) ?? 0;
    rows.set(l, r + 1);
    pos.set(n.id, { x: l * 260, y: r * 90 });
  }
  return pos;
}