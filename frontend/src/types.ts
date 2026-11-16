export type Action = 'create' | 'update' | 'delete' | 'replace' | 'no-op';

export interface GraphNode {
  id: string;              // dirección completa: module.red.aws_vpc.main
  type: string;
  name: string;
  module: string | null;   // module.red, o null si está en la raíz
  action: Action;
  values: Record<string, unknown> | null;
}

export interface GraphEdge { from: string; to: string; }   // dependencia → dependiente
export interface ModuleRef { id: string; parent: string | null; }

export interface GraphModel {
  schemaVersion: number;
  nodes: GraphNode[];
  edges: GraphEdge[];
  modules: ModuleRef[];
  warnings: string[];
}

export interface ApiError { code: string; message: string; }