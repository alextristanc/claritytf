import type { GraphModel } from './types';

// Valor centinela para el filtro de módulo "sin módulo" (module === null).
export const MODULE_NONE = '__null__';

export interface FilterState {
  search: string;
  module: string; // '' = todos, MODULE_NONE = sin módulo, o id de módulo
  type: string;   // '' = todos
  action: string; // '' = todos, o un Action
}

// Devuelve los IDs de los nodos que coinciden con el filtro.
//
// Un nodo pasa si coincide con búsqueda (nombre, tipo, id o dirección de
// cualquiera de sus instancias), módulo, tipo y acción.
//
// Los nodos no coincidentes no se eliminan: se dejan en el grafo y se
// atenuan visualmente desde Graph.tsx, para que el contexto del grafo
// no se pierda al filtrar.
export function activeNodeIds(model: GraphModel, f: FilterState): Set<string> {
  const search = f.search.trim().toLowerCase();

  const out = new Set<string>();
  for (const n of model.nodes) {
    if (search) {
      const haystack = [
        n.name,
        n.type,
        n.id,
        ...n.instances.map((i) => i.address),
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) continue;
    }

    if (f.module) {
      if (f.module === MODULE_NONE) {
        if (n.module !== null) continue;
      } else if (n.module !== f.module) {
        continue;
      }
    }

    if (f.type && !n.type.toLowerCase().includes(f.type.toLowerCase())) continue;

    if (f.action && n.action !== f.action) continue;

    out.add(n.id);
  }
  return out;
}

export function hasFilter(f: FilterState): boolean {
  return Boolean(f.search || f.module || f.type || f.action);
}

export const EMPTY_FILTER: FilterState = { search: '', module: '', type: '', action: '' };
