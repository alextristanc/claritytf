import { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, Controls, MarkerType, Position } from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, GraphModel } from './types';
import { layout, NODE_W, NODE_H } from './layout';
import type { Box } from './layout';
import { dependents } from './useImpact';

export const COLORS: Record<Action, string> = {
  create: '#86efac',
  update: '#fde68a',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#bfdbfe',
};

function ModuleGroup({ data }: NodeProps) {
  return (
    <div style={{
      width: '100%', height: '100%', boxSizing: 'border-box',
      border: '2px dashed #94a3b8', borderRadius: 8, background: 'rgba(148,163,184,0.12)',
      padding: 8, fontSize: 12, fontWeight: 600, color: '#475569',
    }}>
      {(data as { label: string }).label}
    </div>
  );
}
const nodeTypes = { module: ModuleGroup };

const depth = (id: string) => id.split('.module.').length;

interface Props {
  model: GraphModel;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function Graph({ model, selected, onSelect }: Props) {
  const [boxes, setBoxes] = useState<Map<string, Box> | null>(null);

  useEffect(() => {
    let cancelled = false;
    layout(model)
      .then(b => { if (!cancelled) setBoxes(b); })
      .catch(err => { console.error('Layout falló', err); if (!cancelled) setBoxes(new Map()); });
    return () => { cancelled = true; };
  }, [model]);

  const impact = useMemo(
    () => (selected ? dependents(model.edges, selected) : null),
    [model, selected],
  );

  const nodes: Node[] = useMemo(() => {
    if (!boxes) return [];
    const mods = [...model.modules].sort((a, b) => depth(a.id) - depth(b.id));

    const groupNodes: Node[] = mods.map(m => {
      const b = boxes.get(m.id);
      return {
        id: m.id,
        type: 'module',
        position: { x: b?.x ?? 0, y: b?.y ?? 0 },
        parentId: m.parent && boxes.has(m.parent) ? m.parent : undefined,
        data: { label: m.id },
        style: { width: b?.width, height: b?.height },
        selectable: false,
      };
    });

    const resourceNodes: Node[] = model.nodes.map(n => {
      const b = boxes.get(n.id);
      const parent = n.module && boxes.has(n.module) ? n.module : undefined;
      return {
        id: n.id,
        position: { x: b?.x ?? 0, y: b?.y ?? 0 },
        parentId: parent,
        extent: parent ? ('parent' as const) : undefined,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { label: `${n.type}\n${n.name}` },
        style: {
          width: NODE_W, height: NODE_H, padding: 4, fontSize: 12,
          display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
          background: COLORS[n.action], color: '#111', whiteSpace: 'pre-line',
          border: n.id === selected ? '3px solid #111' : '1px solid #555',
          opacity: impact && !impact.has(n.id) ? 0.25 : 1,
        },
      };
    });

    return [...groupNodes, ...resourceNodes]; // los padres van antes que sus hijos
  }, [model, boxes, impact, selected]);

  const edges: Edge[] = useMemo(
    () =>
      model.edges.map(e => {
        const dim = impact !== null && !(impact.has(e.from) && impact.has(e.to));
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          markerEnd: { type: MarkerType.ArrowClosed },
          animated: impact !== null && !dim,
          style: { opacity: dim ? 0.15 : 1 },
        };
      }),
    [model, impact],
  );

  if (!boxes) return <div style={{ padding: 16, color: '#666' }}>Calculando layout…</div>;

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      nodesConnectable={false}
      onNodeClick={(_, n) => { if (n.type !== 'module') onSelect(n.id); }}
      onPaneClick={() => onSelect(null)}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}