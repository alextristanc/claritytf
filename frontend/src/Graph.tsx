import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, GraphModel } from './types';
import { layout } from './layout';

const COLORS: Record<Action, string> = {
  create: '#86efac',
  update: '#fde68a',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#bfdbfe',
};

export default function Graph({ model }: { model: GraphModel }) {
  const { nodes, edges } = useMemo(() => {
    const pos = layout(model);
    const nodes: Node[] = model.nodes.map(n => ({
      id: n.id,
      position: pos.get(n.id) ?? { x: 0, y: 0 },
      data: { label: `${n.type}\n${n.name}` },
      style: {
        background: COLORS[n.action], color: '#111', border: '1px solid #555',
        whiteSpace: 'pre-line', width: 200,
      },
    }));
    const edges: Edge[] = model.edges.map(e => ({
      id: `${e.from}->${e.to}`, source: e.from, target: e.to,
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nodes, edges };
  }, [model]);

  return (
    <ReactFlow nodes={nodes} edges={edges} fitView>
      <Background />
      <Controls />
    </ReactFlow>
  );
}