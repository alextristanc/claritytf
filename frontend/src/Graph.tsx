import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { ReactFlow, Background, Controls, Handle, MarkerType, Position } from '@xyflow/react';
import type { Node, Edge, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, GraphModel } from './types';
import { layout, NODE_W, NODE_H } from './layout';
import type { Box } from './layout';
import { dependents } from './useImpact';
import { COLORS, GLYPHS } from './theme';

// Insignia para bloques con varias instancias (count/for_each).
const badgeStyle: CSSProperties = {
  position: 'absolute', top: 2, right: 2, background: '#111', color: '#fff',
  borderRadius: 8, padding: '0 5px', fontSize: 10, fontWeight: 700, lineHeight: '16px',
};

function ModuleGroup({ data }: NodeProps) {
  const d = data as { label: string; instances: number };
  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%', boxSizing: 'border-box',
      border: '2px dashed #94a3b8', borderRadius: 8, background: 'rgba(148,163,184,0.12)',
      padding: 8, fontSize: 12, fontWeight: 600, color: '#475569',
    }}>
      {d.label}
      {d.instances > 1 && (
        <span style={badgeStyle} title={`${d.instances} instancias`}>×{d.instances}</span>
      )}
    </div>
  );
}

function ResourceNode({ data }: NodeProps) {
  const d = data as { type: string; name: string; action: Action; instances: number };
  const glyph = GLYPHS[d.action];
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      textAlign: 'center',
    }}>
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      {glyph && (
        <span title="Acciones distintas" style={{ position: 'absolute', top: 0, left: 4, fontSize: 11 }}>
          {glyph}
        </span>
      )}
      <span>{d.type}</span>
      <span>{d.name}</span>
      {d.instances > 1 && (
        <span style={badgeStyle} title={`${d.instances} instancias`}>×{d.instances}</span>
      )}
      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes = { module: ModuleGroup, resource: ResourceNode };

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
        data: { label: m.id, instances: m.instances },
        style: { width: b?.width, height: b?.height },
        selectable: false,
      };
    });

    const resourceNodes: Node[] = model.nodes.map(n => {
      const b = boxes.get(n.id);
      const parent = n.module && boxes.has(n.module) ? n.module : undefined;
      return {
        id: n.id,
        type: 'resource',
        position: { x: b?.x ?? 0, y: b?.y ?? 0 },
        parentId: parent,
        extent: parent ? ('parent' as const) : undefined,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        data: { type: n.type, name: n.name, action: n.action, instances: n.instances.length },
        style: {
          width: NODE_W, height: NODE_H, padding: 4, fontSize: 12,
          background: COLORS[n.action], color: '#111',
          border: n.id === selected ? '3px solid #111'
            : n.action === 'mixed' ? '1px dashed #6b7280'
            : '1px solid #555',
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
      <Controls position="bottom-right" />
    </ReactFlow>
  );
}
