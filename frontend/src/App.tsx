import { useRef, useState } from 'react';
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

function Legend() {
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, background: '#fff', color: '#111',
                  border: '1px solid #ddd', borderRadius: 6, padding: 8, fontSize: 13 }}>
      {(Object.keys(LABELS) as Action[]).map(a => (
        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: COLORS[a], border: '1px solid #555' }} />
          <span style={{ width: 10, textAlign: 'center' }}>{GLYPHS[a] ?? ''}</span>
          {LABELS[a]}
        </div>
      ))}
      <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #eee',
                    color: '#555', fontSize: 12, maxWidth: 230 }}>
        Cada flecha es una dependencia declarada en el código, a nivel de bloque.
      </div>
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
  const inputRef = useRef<HTMLInputElement>(null);

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
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          ref={inputRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }}
        />
        <button onClick={() => inputRef.current?.click()} disabled={loading}>
          {model ? 'Cargar otro archivo' : 'Cargar plan.json'}
        </button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          Ejemplo:
          <select value={demoId} onChange={e => loadDemo(e.target.value)} disabled={loading}>
            {DEMOS.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
          </select>
        </label>
        {loading && <span style={{ color: '#666' }}>Procesando…</span>}
        {model && !loading && (
          <span style={{ marginLeft: 'auto', color: '#666', fontSize: 13 }}>
            {source === 'demo' ? 'Modo demo (ejemplo incrustado)' : 'Modo backend'}
          </span>
        )}
      </div>

      {errorCode && (
        <div role="alert" style={{ background: '#fef2f2', color: '#991b1b', borderBottom: '1px solid #fecaca',
                                   padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>{MESSAGES[errorCode]}</span>
          {SUGGEST_DEMO.has(errorCode) && <button onClick={() => loadDemo()}>Usar modo demo</button>}
          <button onClick={() => setErrorCode(null)} style={{ marginLeft: 'auto' }}>✕</button>
        </div>
      )}

      {model && !warningsDismissed && warnings.length > 0 && (
        <div role="status" style={{ background: '#fffbeb', color: '#92400e', borderBottom: '1px solid #fde68a',
                                    padding: '8px 12px', display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13 }}>
          <span style={{ whiteSpace: 'nowrap' }}>
            ⚠ {warnings.length} advertencia{warnings.length === 1 ? '' : 's'}
          </span>
          <details style={{ flex: 1 }}>
            <summary style={{ cursor: 'pointer' }}>Ver detalle</summary>
            <ul style={{ margin: '6px 0 0 18px', padding: 0 }}>
              {warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
          <button onClick={() => setWarningsDismissed(true)} aria-label="Cerrar advertencias">✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {model ? (
            <>
              <Graph key={version} model={model} selected={selected} onSelect={setSelected} />
              <Legend />
            </>
          ) : (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#666', textAlign: 'center', padding: 24 }}>
              Arrastra tu plan.json aquí, pulsa "Cargar plan.json" o prueba con el ejemplo.
            </div>
          )}
        </div>
        {selectedNode && (
          <DetailsPanel key={selectedNode.id} node={selectedNode} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}