import type { Action } from './types';

// Colores por acción: compartidos por el grafo, la leyenda y el panel de detalles.
export const COLORS: Record<Action, string> = {
  create: '#86efac',
  update: '#fde68a',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#bfdbfe',
};

// Etiquetas en español usadas en la leyenda y en el panel de detalles.
export const LABELS: Record<Action, string> = {
  create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
  replace: 'Reemplazar', 'no-op': 'Sin cambios',
};
