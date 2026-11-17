import { describe, it, expect } from 'vitest';
import { DEMOS } from '../demos';
import type { Action } from '../types';

const ACTIONS: Action[] = ['create', 'update', 'delete', 'replace', 'no-op'];

describe('demos', () => {
  for (const demo of DEMOS) {
    describe(demo.label, () => {
      const model = demo.model;
      const nodeIds = new Set(model.nodes.map(n => n.id));
      const moduleIds = new Set(model.modules.map(m => m.id));

      it('tiene ids de nodo únicos', () => {
        expect(nodeIds.size).toBe(model.nodes.length);
      });

      it('no tiene aristas con extremos inexistentes', () => {
        for (const e of model.edges) {
          expect(nodeIds.has(e.from), `origen inexistente: ${e.from}`).toBe(true);
          expect(nodeIds.has(e.to), `destino inexistente: ${e.to}`).toBe(true);
        }
      });

      it('no tiene autoaristas', () => {
        for (const e of model.edges) {
          expect(e.from, `autoarista en ${e.from}`).not.toBe(e.to);
        }
      });

      it('todo node.module existe en modules', () => {
        for (const n of model.nodes) {
          if (n.module !== null) {
            expect(moduleIds.has(n.module), `módulo inexistente: ${n.module}`).toBe(true);
          }
        }
      });

      it('usa solo acciones válidas', () => {
        for (const n of model.nodes) {
          expect(ACTIONS, `acción inválida en ${n.id}`).toContain(n.action);
        }
      });
    });
  }
});
