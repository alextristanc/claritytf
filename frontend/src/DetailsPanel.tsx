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
    <section className="panel-section">
      <h3 className="panel-section-title">
        {title}
        <span className="count-pill">{names.length}</span>
      </h3>
      <ul className="panel-list">
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
    <aside className="details-panel" aria-labelledby="panel-title">
      <div className="sheet-handle" aria-hidden="true" />

      <header className="panel-head">
        <div className="panel-head-row">
          <span className="action-badge" style={{ background: COLORS[node.action] }}>
            {GLYPHS[node.action] ? `${GLYPHS[node.action]} ` : ''}{LABELS[node.action]}
          </span>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="Cerrar panel">
            ✕
          </button>
        </div>
        <h2 className="panel-title" id="panel-title">{node.name}</h2>
        <div className="panel-type">{node.type}</div>
        <div className="panel-id">{node.id}</div>
        {node.module && (
          <div className="panel-module">Módulo: <code>{node.module}</code></div>
        )}
      </header>

      {node.instances.length > 1 && (
        <section className="panel-section">
          <h3 className="panel-section-title">
            Instancias
            <span className="count-pill">{node.instances.length}</span>
          </h3>
          <div className="instance-list" role="radiogroup" aria-label="Instancias del bloque">
            {node.instances.map((inst, i) => (
              <label
                key={inst.address}
                className={`instance-option${i === selected ? ' is-selected' : ''}`}
              >
                <input
                  className="instance-radio"
                  type="radio"
                  name={`instancia-${node.id}`}
                  checked={i === selected}
                  onChange={() => setIndex(i)}
                />
                <span className="instance-action" style={{ background: COLORS[inst.action] }}>
                  {LABELS[inst.action]}
                </span>
                <span className="instance-address">{inst.address}</span>
              </label>
            ))}
          </div>
        </section>
      )}

      <NameList title="Se conocerán al aplicar" names={instance?.unknown ?? []} />
      <NameList title="Valores sensibles ocultos" names={instance?.sensitive ?? []} />

      {node.unresolved.length > 0 && (
        <section className="panel-section">
          <h3 className="panel-section-title">
            Dependencias no trazables
            <span className="count-pill">{node.unresolved.length}</span>
          </h3>
          <ul className="panel-list">
            {node.unresolved.map(r => <li key={r}>{r}</li>)}
          </ul>
          <p className="panel-note">
            Terraform las declara pero el plan no permite trazarlas.
          </p>
        </section>
      )}

      <section className="panel-section">
        <h3 className="panel-section-title">Valores</h3>
        {known.length === 0 && <p className="panel-empty">Sin valores conocidos.</p>}
        <div className="value-list">
          {known.map(([k, v]) => (
            <div key={k} className="value-row">
              <span className="value-key">{k}</span>
              <span className="value-val">{fmt(v)}</span>
            </div>
          ))}
        </div>
        {withoutValue.length > 0 && (
          <details className="panel-details">
            <summary>{withoutValue.length} sin valor</summary>
            <ul className="panel-list">
              {withoutValue.map(k => <li key={k}>{k}</li>)}
            </ul>
          </details>
        )}
      </section>

      <p className="panel-footer">
        Los valores son de la instancia seleccionada. Las flechas conectan bloques, no instancias.
      </p>
    </aside>
  );
}
