import { useEffect, useRef, useState } from 'react';
import Graph from './Graph';
import DetailsPanel from './DetailsPanel';
import { DEFAULT_DEMO_ID, DEMOS, getDemo } from './demos';
import { COLORS, GLYPHS, LABELS } from './theme';
import type { Action, ApiError, GraphModel } from './types';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080';
const MAX_BYTES = 5_000_000;

const MESSAGES: Record<string, string> = {
  NO_FILE: 'Selecciona un archivo para continuar.',
  FILE_TOO_LARGE: 'El archivo es demasiado grande (máx. 5 MB).',
  INVALID_JSON: 'El archivo no es un JSON válido.',
  NOT_A_PLAN: 'No parece un plan de Terraform. Genéralo con: terraform show -json plan.tfplan',
  EMPTY_PLAN: 'El plan no contiene recursos.',
  WRONG_EXTENSION: 'Sube un archivo .json.',
  BACKEND_UNREACHABLE: 'No se pudo conectar al backend local. Prueba el modo demo.',
  INTERNAL_ERROR: 'Ocurrió un error al procesar el archivo.',
};
const SUGGEST_DEMO = new Set(['NOT_A_PLAN', 'BACKEND_UNREACHABLE']);

function BrandMark() {
  return (
    <span className="brand-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
        <path d="M12 2.6 20.5 7.4v9.2L12 21.4 3.5 16.6V7.4z" />
        <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
        <path d="M12 9.9V6.6M10.2 13l-2.7 1.6M13.8 13l2.7 1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function EmptyIcon() {
  return (
    <span className="empty-icon" aria-hidden="true">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor"
           strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5M9 13h6M9 17h4" />
      </svg>
    </span>
  );
}

function Legend() {
  return (
    <div className="legend" role="region" aria-label="Leyenda de acciones">
      <div className="legend-items">
        {(Object.keys(LABELS) as Action[]).map(a => (
          <div key={a} className="legend-item">
            <span
              className="legend-swatch"
              aria-hidden="true"
              style={{ background: COLORS[a], color: COLORS[a] }}
            />
            <span className="legend-glyph" aria-hidden="true">{GLYPHS[a] ?? ''}</span>
            <span>{LABELS[a]}</span>
          </div>
        ))}
      </div>
      <p className="legend-scope">
        Cada flecha es una dependencia declarada en el código, a nivel de bloque.
      </p>
    </div>
  );
}

export default function App() {
  const [model, setModel] = useState<GraphModel | null>(null);
  const [source, setSource] = useState<'demo' | 'backend'>('backend');
  const [version, setVersion] = useState(0);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [warningsDismissed, setWarningsDismissed] = useState(false);
  const [demoId, setDemoId] = useState(DEFAULT_DEMO_ID);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  function show(m: GraphModel, src: 'demo' | 'backend') {
    setModel(m);
    setSource(src);
    setSelected(null);
    setWarningsDismissed(false);
    setVersion(v => v + 1);
  }

  function loadDemo(id: string = DEFAULT_DEMO_ID) {
    setErrorCode(null);
    setDemoId(id);
    show(getDemo(id).model, 'demo');
  }

  async function load(file: File) {
    setErrorCode(null);
    if (!file.name.endsWith('.json')) { setErrorCode('WRONG_EXTENSION'); return; }
    if (file.size > MAX_BYTES) { setErrorCode('FILE_TOO_LARGE'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/parse`, { method: 'POST', body: file });
      if (!res.ok) {
        const err: ApiError = await res.json().catch(() => ({ code: 'INTERNAL_ERROR', message: '' }));
        setErrorCode(err.code in MESSAGES ? err.code : 'INTERNAL_ERROR');
        return;
      }
      show(await res.json(), 'backend');
    } catch {
      setErrorCode('BACKEND_UNREACHABLE');
    } finally {
      setLoading(false);
    }
  }

  const selectedNode = model?.nodes.find(n => n.id === selected) ?? null;
  const warnings = model
    ? [
        ...(model.schemaVersion !== 2
          ? [`Versión de modelo no esperada: ${model.schemaVersion} (se esperaba 2).`]
          : []),
        ...model.warnings,
      ]
    : [];

  return (
    <div
      className={`app-shell${dragActive ? ' drag-active' : ''}`}
      onDragEnter={e => { e.preventDefault(); setDragActive(true); }}
      onDragOver={e => e.preventDefault()}
      onDragLeave={e => { if (e.currentTarget === e.target) setDragActive(false); }}
      onDrop={e => {
        e.preventDefault();
        setDragActive(false);
        const f = e.dataTransfer.files[0];
        if (f) load(f);
      }}
    >
      <header className="app-header">
        <div className="brand">
          <BrandMark />
          <div>
            <h1 className="brand-title">ClarityTF</h1>
            <p className="brand-sub">Terraform plan, claro</p>
          </div>
        </div>

        <div className="toolbar">
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) load(f);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => inputRef.current?.click()}
            disabled={loading}
          >
            {model ? 'Cargar otro archivo' : 'Cargar plan.json'}
          </button>

          <label className="demo-field">
            <span>Ejemplo</span>
            <select
              className="select"
              value={demoId}
              onChange={e => loadDemo(e.target.value)}
              disabled={loading}
            >
              {DEMOS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
            </select>
          </label>

          {loading && (
            <span className="loading-chip" role="status">
              <span className="spinner" aria-hidden="true" />
              Procesando…
            </span>
          )}

          {model && !loading && (
            <span
              className={`mode-badge${source === 'demo' ? ' is-demo' : ''}`}
              title={source === 'demo' ? 'Ejemplo incrustado, sin backend' : 'Plan procesado por el backend local'}
            >
              {source === 'demo' ? 'Modo demo' : 'Backend local'}
            </span>
          )}
        </div>
      </header>

      {errorCode && (
        <div role="alert" className="alert alert-error">
          <span className="alert-icon" aria-hidden="true">⚠</span>
          <div className="alert-body">{MESSAGES[errorCode]}</div>
          <div className="alert-actions">
            {SUGGEST_DEMO.has(errorCode) && (
              <button type="button" className="btn" onClick={() => loadDemo()}>
                Usar modo demo
              </button>
            )}
            <button
              type="button"
              className="btn-icon"
              onClick={() => setErrorCode(null)}
              aria-label="Cerrar error"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {model && !warningsDismissed && warnings.length > 0 && (
        <div role="status" className="alert alert-warning">
          <span className="alert-icon" aria-hidden="true">⚠</span>
          <div className="alert-body">
            <strong>
              {warnings.length} advertencia{warnings.length === 1 ? '' : 's'}
            </strong>
            <details>
              <summary>Ver detalle</summary>
              <ul>
                {warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            </details>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setWarningsDismissed(true)}
            aria-label="Cerrar advertencias"
          >
            ✕
          </button>
        </div>
      )}

      <main className="workspace" aria-busy={loading}>
        <section className="graph-area" aria-label="Grafo de dependencias">
          {model ? (
            <>
              <Legend />
              <div className="graph-canvas">
                <Graph key={version} model={model} selected={selected} onSelect={setSelected} />
              </div>
            </>
          ) : (
            <div className="empty-state">
              <div className="dropzone">
                <EmptyIcon />
                <h2 className="empty-title">Arrastra tu plan.json</h2>
                <p className="empty-text">
                  Verás los bloques, sus instancias y las dependencias declaradas en
                  el código. Nada se inventa: lo no trazable se marca.
                </p>
                <div className="empty-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => inputRef.current?.click()}
                    disabled={loading}
                  >
                    Cargar plan.json
                  </button>
                  <button type="button" className="btn" onClick={() => loadDemo()}>
                    Probar demo
                  </button>
                </div>
                <p className="empty-hint">
                  Genera el archivo con <code>terraform show -json plan.tfplan</code>
                </p>
              </div>
            </div>
          )}
        </section>

        {selectedNode && (
          <div className="panel-layer">
            <button
              type="button"
              className="panel-backdrop"
              onClick={() => setSelected(null)}
              aria-label="Cerrar panel de detalles"
            />
            <DetailsPanel
              key={selectedNode.id}
              node={selectedNode}
              onClose={() => setSelected(null)}
            />
          </div>
        )}
      </main>
    </div>
  );
}
