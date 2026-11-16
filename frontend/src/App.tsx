import { useState } from 'react';
import Graph from './Graph';
import type { ApiError, GraphModel } from './types';

export default function App() {
  const [model, setModel] = useState<GraphModel | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    } catch {
      setError('No se pudo conectar al backend local.');
    }
  }

  return (
    <div
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) load(f); }}
    >
      <div style={{ padding: 12, borderBottom: '1px solid #ddd' }}>
        <input type="file" accept=".json" onChange={e => e.target.files?.[0] && load(e.target.files[0])} />
        <span style={{ marginLeft: 12, color: '#666' }}>o arrastra tu plan.json aquí</span>
        {error && <div style={{ color: '#b91c1c', marginTop: 8 }}>{error}</div>}
      </div>
      <div style={{ flex: 1 }}>{model && <Graph model={model} />}</div>
    </div>
  );
}