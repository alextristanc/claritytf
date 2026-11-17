import type { Action } from './types';

// Colores por acción: acentos vivos sobre fondo oscuro. Se usan como borde/glow
// de los nodos y como fondo de las insignias de la leyenda y del panel.
export const COLORS: Record<Action, string> = {
  create: '#6ee7b7',
  update: '#fcd34d',
  delete: '#fca5a5',
  replace: '#fdba74',
  'no-op': '#93c5fd',
  mixed: '#cbd5e1',
};

// Etiquetas en español usadas en la leyenda y en el panel de detalles.
export const LABELS: Record<Action, string> = {
  create: 'Crear', update: 'Actualizar', delete: 'Eliminar',
  replace: 'Reemplazar', 'no-op': 'Sin cambios', mixed: 'Mixto',
};

// Glifo propio para las acciones que no se distinguen solo por color.
export const GLYPHS: Partial<Record<Action, string>> = {
  mixed: '◆',
};
