import { useMemo } from 'react';
import { ReactFlow, Background, Controls, MarkerType } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, GraphModel } from './types';
import { layout } from './layout';
import { dependents } from './useImpact';

export const COLORS: Record<Action, string> = {
  create: '#86efac',
  update: '#fde68a',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#bfdbfe',
};

interface Props {
  model: GraphModel;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export default function Graph({ model, selected, onSelect }: Props) {
  const positions = useMemo(() => layout(model), [model]);
  const impact = useMemo(
    () => (selected ? dependents(model.edges, selected) : null),
    [model, selected],
  );

  const nodes: Node[] = useMemo(
    () =>
      model.nodes.map(n => ({
        id: n.id,
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        data: { label: `${n.type}\n${n.name}` },
        style: {
          background: COLORS[n.action],
          color: '#111',
          whiteSpace: 'pre-line',
          width: 200,
          border: n.id === selected ? '3px solid #111' : '1px solid #555',
          opacity: impact && !impact.has(n.id) ? 0.25 : 1,
        },
      })),
    [model, positions, impact, selected],
  );

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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      fitView
      nodesConnectable={false}
      onNodeClick={(_, n) => onSelect(n.id)}
      onPaneClick={() => onSelect(null)}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
}