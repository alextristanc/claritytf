import type { ElkNode } from 'elkjs/lib/elk-api';
import type { GraphModel } from './types';

export const NODE_W = 200;
export const NODE_H = 75;

export interface Box { x: number; y: number; width: number; height: number; }

// Devuelve posición y tamaño de cada nodo y módulo (coordenadas relativas al padre)
export async function layout(model: GraphModel): Promise<Map<string, Box>> {
  // Carga diferida: elkjs es la mayor parte del bundle y solo hace falta al dibujar.
  const { default: ELK } = await import('elkjs/lib/elk.bundled.js');
  const elk = new ELK();
  const groups = new Map<string, ElkNode>();
  for (const m of model.modules) {
    groups.set(m.id, {
      id: m.id,
      children: [],
      layoutOptions: { 'elk.padding': '[top=40,left=20,bottom=20,right=20]' },
    });
  }

  const root: ElkNode = {
    id: 'root',
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': 'RIGHT',
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN',
      'elk.spacing.nodeNode': '30',
      'elk.layered.spacing.nodeNodeBetweenLayers': '60',
    },
    children: [],
    edges: [],
  };

  for (const m of model.modules) {
    const parent = m.parent ? groups.get(m.parent) : undefined;
    (parent ?? root).children!.push(groups.get(m.id)!);
  }
  for (const n of model.nodes) {
    const holder = (n.module && groups.get(n.module)) || root;
    holder.children!.push({ id: n.id, width: NODE_W, height: NODE_H });
  }
  root.edges = model.edges.map(e => ({
    id: `${e.from}->${e.to}`,
    sources: [e.from],
    targets: [e.to],
  }));

  const out = await elk.layout(root);

  const boxes = new Map<string, Box>();
  const walk = (n: ElkNode) => {
    for (const c of n.children ?? []) {
      boxes.set(c.id, { x: c.x ?? 0, y: c.y ?? 0, width: c.width ?? NODE_W, height: c.height ?? NODE_H });
      walk(c);
    }
  };
  walk(out);
  return boxes;
}