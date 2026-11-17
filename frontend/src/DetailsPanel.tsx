import type { GraphNode } from './types';
import { COLORS, LABELS } from './theme';

function fmt(v: unknown): string {
  const s = typeof v === 'string' ? v : JSON.stringify(v);
  return s.length > 200 ? s.slice(0, 200) + '…' : s;
}

export default function DetailsPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const entries = Object.entries(node.values ?? {}).filter(
    ([, v]) => v !== null && !(Array.isArray(v) && v.length === 0),
  );
  return (
    <aside style={{ width: 320, borderLeft: '1px solid #ddd', padding: 16, overflow: 'auto', fontSize: 14, background: '#fff', color: '#111' }}>
      <button onClick={onClose} style={{ float: 'right' }}>✕</button>
      <span style={{ background: COLORS[node.action], padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
        {LABELS[node.action]}
      </span>
      <h3 style={{ margin: '12px 0 4px' }}>{node.name}</h3>
      <div style={{ color: '#555' }}>{node.type}</div>
      <div style={{ color: '#555', wordBreak: 'break-all' }}>{node.id}</div>
      {node.module && <div style={{ color: '#555' }}>Módulo: {node.module}</div>}
      <hr />
      {entries.length === 0 && <p style={{ color: '#777' }}>Sin valores conocidos.</p>}
      {entries.map(([k, v]) => (
        <div key={k} style={{ marginBottom: 8 }}>
          <div style={{ fontWeight: 600 }}>{k}</div>
          <div style={{ wordBreak: 'break-all' }}>{fmt(v)}</div>
        </div>
      ))}
    </aside>
  );
}