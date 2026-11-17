export type Action = 'create' | 'update' | 'delete' | 'replace' | 'no-op' | 'mixed';

// Una instancia concreta nunca es "mixed": esa acción solo agrega el bloque.
export type InstanceAction = Exclude<Action, 'mixed'>;

export interface GraphInstance {
  address: string;
  action: InstanceAction;
  values: Record<string, unknown> | null;
  unknown: string[];
  sensitive: string[];
}

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  module: string | null;
  action: Action;
  instances: GraphInstance[];
  unresolved: string[];
}
export interface GraphEdge { from: string; to: string; }
export interface ModuleRef { id: string; parent: string | null; instances: number; }
export interface GraphModel {
  schemaVersion: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  modules: ModuleRef[];
  warnings: string[];
}
export interface ApiError { code: string; message: string; }
