import { useState } from 'react';
import type { GraphNode } from './types';
import { COLORS, GLYPHS, LABELS } from './theme';
import { splitValues } from './details';

function fmt(v: unknown): string {
  if (v === undefined) return '—';
  const s = typeof v === 'string' ? v : JSON.stringify(v) ?? '—';
  return s.length > 200 ? s.slice(0, 200) + '…' : s;
}

// Sección con lista de nombres: solo se pinta si hay elementos.
function NameList({ title, names }: { title: string; names: string[] }) {
  if (names.length === 0) return null;
  return (
    <section style={{ marginTop: 12 }}>
      <div style={{ fontWeight: 600 }}>{title} ({names.length})</div>
      <ul style={{ margin: '4px 0 0 18px', padding: 0, wordBreak: 'break-all' }}>
        {names.map(n => <li key={n}>{n}</li>)}
      </ul>
    </section>
  );
}

export default function DetailsPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const [index, setIndex] = useState(0);

  const selected = Math.min(index, node.instances.length - 1);
  const instance = node.instances[selected];
  const { known, withoutValue } = splitValues(instance?.values);

  return (
    <aside style={{ width: 320, borderLeft: '1px solid #ddd', padding: 16, overflow: 'auto', fontSize: 14, background: '#fff', color: '#111' }}>
      <button onClick={onClose} style={{ float: 'right' }}>✕</button>
      <span style={{ background: COLORS[node.action], padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>
        {GLYPHS[node.action] ? `${GLYPHS[node.action]} ` : ''}{LABELS[node.action]}
      </span>
      <h3 style={{ margin: '12px 0 4px' }}>{node.name}</h3>
      <div style={{ color: '#555' }}>{node.type}</div>
      <div style={{ color: '#555', wordBreak: 'break-all' }}>{node.id}</div>
      {node.module && <div style={{ color: '#555' }}>Módulo: {node.module}</div>}
      <hr />

      {node.instances.length > 1 && (
        <section>
          <div style={{ fontWeight: 600 }}>Instancias ({node.instances.length})</div>
          {node.instances.map((inst, i) => (
            <label key={inst.address} style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 4, cursor: 'pointer' }}>
              <input
                type="radio"
                name={`instancia-${node.id}`}
                checked={i === selected}
                onChange={() => setIndex(i)}
              />
              <span style={{ background: COLORS[inst.action], padding: '0 6px', borderRadius: 4, fontSize: 12 }}>
                {LABELS[inst.action]}
              </span>
              <span style={{ wordBreak: 'break-all' }}>{inst.address}</span>
            </label>
          ))}
        </section>
      )}

      <NameList title="Se conocerán al aplicar" names={instance?.unknown ?? []} />
      <NameList title="Valores sensibles ocultos" names={instance?.sensitive ?? []} />

      {node.unresolved.length > 0 && (
        <section style={{ marginTop: 12 }}>
          <div style={{ fontWeight: 600 }}>Dependencias no trazables</div>
          <ul style={{ margin: '4px 0 0 18px', padding: 0, wordBreak: 'break-all' }}>
            {node.unresolved.map(r => <li key={r}>{r}</li>)}
          </ul>
          <p style={{ color: '#555', margin: '4px 0 0', fontSize: 12 }}>
            Terraform las declara pero el plan no permite trazarlas.
          </p>
        </section>
      )}

      <section style={{ marginTop: 12 }}>
        {known.length === 0 && <p style={{ color: '#777' }}>Sin valores conocidos.</p>}
        {known.map(([k, v]) => (
          <div key={k} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{k}</div>
            <div style={{ wordBreak: 'break-all' }}>{fmt(v)}</div>
          </div>
        ))}
        {withoutValue.length > 0 && (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer', color: '#555' }}>
              {withoutValue.length} sin valor
            </summary>
            <ul style={{ margin: '4px 0 0 18px', padding: 0, wordBreak: 'break-all' }}>
              {withoutValue.map(k => <li key={k}>{k}</li>)}
            </ul>
          </details>
        )}
      </section>

      <p style={{ color: '#666', marginTop: 16, fontSize: 12 }}>
        Los valores son de la instancia seleccionada. Las flechas conectan bloques, no instancias.
      </p>
    </aside>
  );
}
