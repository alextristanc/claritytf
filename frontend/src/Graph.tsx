import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  useReactFlow,
} from '@xyflow/react';
import type { Edge, Node, NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { Action, GraphModel } from './types';
import { layout, NODE_W, NODE_H } from './layout';
import type { Box } from './layout';
import { dependents } from './useImpact';
import { COLORS, GLYPHS } from './theme';

interface ResourceData {
  type: string;
  name: string;
  action: Action;
  instances: number;
}

interface ModuleData {
  label: string;
  instances: number;
  depth: number;
}

function ModuleGroup({ data }: NodeProps) {
  const d = data as unknown as ModuleData;
  return (
    <div className={`tf-module${d.depth > 2 ? ' is-nested' : ''}`}>
      <span className="tf-module-label">{d.label}</span>
      {d.instances > 1 && (
        <span className="node-badge" title={`${d.instances} instancias`}>×{d.instances}</span>
      )}
    </div>
  );
}

function ResourceNode({ data }: NodeProps) {
  const d = data as unknown as ResourceData;
  const glyph = GLYPHS[d.action];
  return (
    <div className="node-card">
      <Handle type="target" position={Position.Left} className="tf-handle" />
      <span className="node-type">
        {glyph && <span className="node-glyph" title="Acciones distintas">{glyph}</span>}
        <span className="node-type-text" title={d.type}>{d.type}</span>
      </span>
      <span className="node-name" title={d.name}>{d.name}</span>
      {d.instances > 1 && (
        <span className="node-badge" title={`${d.instances} instancias`}>×{d.instances}</span>
      )}
      <Handle type="source" position={Position.Right} className="tf-handle" />
    </div>
  );
}

const nodeTypes = { module: ModuleGroup, resource: ResourceNode };

// Reencuadra el grafo cuando cambia el tamaño del lienzo (p. ej. al abrir el panel).
function FitOnResize() {
  const { fitView } = useReactFlow();

  useEffect(() => {
    const el = document.querySelector('.react-flow');
    if (!el) return;
    let timer: number | undefined;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { void fitView({ padding: 0.14 }); }, 160);
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [fitView]);

  return null;
}

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
        data: { label: m.id, instances: m.instances, depth: depth(m.id) },
        style: { width: b?.width, height: b?.height },
        selectable: false,
      };
    });

    const resourceNodes: Node[] = model.nodes.map(n => {
      const b = boxes.get(n.id);
      const parent = n.module && boxes.has(n.module) ? n.module : undefined;
      const dim = impact !== null && !impact.has(n.id);
      return {
        id: n.id,
        type: 'resource',
        position: { x: b?.x ?? 0, y: b?.y ?? 0 },
        parentId: parent,
        extent: parent ? ('parent' as const) : undefined,
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
        className: [
          'tf-node',
          n.action === 'mixed' ? 'is-mixed' : '',
          n.id === selected ? 'is-selected' : '',
          dim ? 'is-dim' : '',
        ].filter(Boolean).join(' '),
        data: { type: n.type, name: n.name, action: n.action, instances: n.instances.length },
        style: {
          width: NODE_W,
          height: NODE_H,
          '--node-color': COLORS[n.action],
        } as CSSProperties,
      };
    });

    return [...groupNodes, ...resourceNodes]; // los padres van antes que sus hijos
  }, [model, boxes, impact, selected]);

  const edges: Edge[] = useMemo(
    () =>
      model.edges.map(e => {
        const dim = impact !== null && !(impact.has(e.from) && impact.has(e.to));
        const active = impact !== null && !dim;
        const color = active ? '#22d3ee' : 'rgba(148, 163, 184, 0.5)';
        return {
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color },
          animated: active,
          style: {
            stroke: color,
            strokeWidth: active ? 1.8 : 1.25,
            opacity: dim ? 0.1 : 1,
          },
        };
      }),
    [model, impact],
  );

  if (!boxes) {
    return (
      <div className="graph-loading" role="status">
        <span className="spinner" aria-hidden="true" />
        Calculando layout…
      </div>
    );
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.14 }}
      minZoom={0.2}
      maxZoom={1.8}
      nodesConnectable={false}
      ariaLabelConfig={{
        'controls.ariaLabel': 'Controles del grafo',
        'controls.zoomIn.ariaLabel': 'Acercar',
        'controls.zoomOut.ariaLabel': 'Alejar',
        'controls.fitView.ariaLabel': 'Ajustar vista',
      }}
      onNodeClick={(_, n) => { if (n.type !== 'module') onSelect(n.id); }}
      onPaneClick={() => onSelect(null)}
    >
      <FitOnResize />
      <Background
        variant={BackgroundVariant.Dots}
        gap={26}
        size={1.2}
        color="rgba(148, 163, 184, 0.18)"
      />
      <Controls position="bottom-right" showInteractive={false} />
    </ReactFlow>
  );
}
