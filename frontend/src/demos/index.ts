import type { GraphModel } from '../types';
import basico from '../demoModel.json';
import mixto from './mixto';

export interface Demo {
  id: string;
  label: string;
  model: GraphModel;
}

// El orden define el selector; el primero también es el demo por defecto.
export const DEMOS: Demo[] = [
  { id: 'mixto', label: 'Módulos y cambios mixtos', model: mixto },
  { id: 'basico', label: 'Básico', model: basico as unknown as GraphModel },
];

export const DEFAULT_DEMO_ID = 'mixto';

export function getDemo(id: string): Demo {
  return DEMOS.find(d => d.id === id) ?? DEMOS[0];
}
