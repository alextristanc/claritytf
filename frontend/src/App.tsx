import { useRef, useState } from 'react';
import Graph, { COLORS } from './Graph';
import DetailsPanel from './DetailsPanel';
import type { Action, ApiError, GraphModel } from './types';

const LABELS: Record<Action, string> = {
  create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
  replace: 'Reemplazar', 'no-op': 'Sin cambios',
};

function Legend() {
  return (
    <div style={{ position: 'absolute', left: 12, bottom: 12, zIndex: 5, background: '#fff', color: '#111',
                  border: '1px solid #ddd', borderRadius: 6, padding: 8, fontSize: 13 }}>
      {(Object.keys(LABELS) as Action[]).map(a => (
        <div key={a} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 12, height: 12, background: COLORS[a], border: '1px solid #555' }} />
          {LABELS[a]}
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [model, setModel] = useState<GraphModel | null>(null);
  const [version, setVersion] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load(file: File) {
    setError(null);
    if (!file.name.endsWith('.json')) { setError('Sube un archivo .json.'); return; }
    try {
      const res = await fetch('http://localhost:8080/parse', { method: 'POST', body: file });
      if (!res.ok) {
        const err: ApiError = await res.json();
        setError(`${err.code}: ${err.message}`);
        return;
      }
      setModel(await res.json());
      setSelected(null);
      setVersion(v => v + 1);
    } catch {
      setError('No se pudo conectar al backend local.');
    }
  }

  const selectedNode = model?.nodes.find(n => n.id === selected) ?? null;

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
        <input
          ref={inputRef} type="file" accept=".json" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) load(f); e.target.value = ''; }}
        />
        <button onClick={() => inputRef.current?.click()}>
          {model ? 'Cargar otro archivo' : 'Cargar plan.json'}
        </button>
        <span style={{ marginLeft: 12, color: '#666' }}>o arrastra tu plan.json aquí</span>
        {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}
      </div>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          {model && <Graph key={version} model={model} selected={selected} onSelect={setSelected} />}
          {model && <Legend />}
        </div>
        {selectedNode && <DetailsPanel node={selectedNode} onClose={() => setSelected(null)} />}
      </div>
    </div>
  );
}