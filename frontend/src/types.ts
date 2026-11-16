export type Action = 'create' | 'update' | 'delete' | 'replace' | 'no-op';

export interface GraphNode {
  id: string;
  type: string;
  name: string;
  module: string | null;
  action: Action;
  values: Record<string, unknown> | null;
}
export interface GraphEdge { from: string; to: string; }
export interface ModuleRef { id: string; parent: string | null; }
export interface GraphModel {
  schemaVersion: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  modules: ModuleRef[];
  warnings: string[];
}
export interface ApiError { code: string; message: string; }