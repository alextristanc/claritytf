import { describe, it, expect } from 'vitest';
import { DEMOS, getDemo } from '../demos';
import { COLORS, GLYPHS, LABELS } from '../theme';
import type { Action, InstanceAction } from '../types';

const INSTANCE_ACTIONS: InstanceAction[] = ['create', 'update', 'delete', 'replace', 'no-op'];
const ACTIONS: Action[] = [...INSTANCE_ACTIONS, 'mixed'];

describe('demos', () => {
  for (const demo of DEMOS) {
    describe(demo.label, () => {
      const model = demo.model;
      const nodeIds = new Set(model.nodes.map(n => n.id));
      const moduleIds = new Set(model.modules.map(m => m.id));

      it('usa el modelo v2', () => {
        expect(model.schemaVersion).toBe(2);
      });

      it('tiene ids de nodo únicos', () => {
        expect(nodeIds.size).toBe(model.nodes.length);
      });

      it('no tiene aristas con extremos inexistentes, repetidas ni autoaristas', () => {
        const seen = new Set<string>();
        for (const e of model.edges) {
          expect(nodeIds.has(e.from), `origen inexistente: ${e.from}`).toBe(true);
          expect(nodeIds.has(e.to), `destino inexistente: ${e.to}`).toBe(true);
          expect(e.from, `autoarista en ${e.from}`).not.toBe(e.to);
          const key = `${e.from}->${e.to}`;
          expect(seen.has(key), `arista duplicada: ${key}`).toBe(false);
          seen.add(key);
        }
      });

      it('todo node.module existe en modules', () => {
        for (const n of model.nodes) {
          if (n.module !== null) {
            expect(moduleIds.has(n.module), `módulo inexistente: ${n.module}`).toBe(true);
          }
        }
      });

      it('todo module.parent existe y las instancias son >= 1', () => {
        for (const m of model.modules) {
          if (m.parent !== null) {
            expect(moduleIds.has(m.parent), `padre inexistente: ${m.parent}`).toBe(true);
          }
          expect(m.instances, `instancias inválidas en ${m.id}`).toBeGreaterThanOrEqual(1);
        }
      });

      it('usa solo acciones válidas y coherentes con sus instancias', () => {
        for (const n of model.nodes) {
          expect(ACTIONS, `acción inválida en ${n.id}`).toContain(n.action);
          expect(n.instances.length, `bloque sin instancias: ${n.id}`).toBeGreaterThan(0);

          const actions = new Set(n.instances.map(i => i.action));
          const expected = actions.size === 1 ? [...actions][0] : 'mixed';
          expect(n.action, `acción incoherente en ${n.id}`).toBe(expected);
        }
      });

      it('cada instancia pertenece a su bloque y no repite unknown/sensitive', () => {
        for (const n of model.nodes) {
          const addresses = new Set<string>();
          for (const i of n.instances) {
            expect(addresses.has(i.address), `instancia duplicada: ${i.address}`).toBe(false);
            addresses.add(i.address);
            expect(i.address === n.id || i.address.startsWith(`${n.id}[`),
              `instancia fuera del bloque ${n.id}: ${i.address}`).toBe(true);
            expect(INSTANCE_ACTIONS, `acción de instancia inválida: ${i.address}`).toContain(i.action);
            expect(new Set(i.unknown).size, `unknown duplicado en ${i.address}`).toBe(i.unknown.length);
            expect(new Set(i.sensitive).size, `sensitive duplicado en ${i.address}`).toBe(i.sensitive.length);
          }
          expect(new Set(n.unresolved).size, `unresolved duplicado en ${n.id}`).toBe(n.unresolved.length);
        }
      });
    });
  }

  it('el demo mixto ejercita la insignia ×N y la acción mixed', () => {
    const model = getDemo('mixto').model;
    expect(model.nodes.some(n => n.instances.length > 1)).toBe(true);
    expect(model.nodes.some(n => n.action === 'mixed')).toBe(true);
  });

  it('el demo mixto ejercita las secciones del panel', () => {
    const model = getDemo('mixto').model;
    const instances = model.nodes.flatMap(n => n.instances);
    expect(instances.some(i => i.unknown.length > 0)).toBe(true);
    expect(instances.some(i => i.sensitive.length > 0)).toBe(true);
    expect(model.nodes.some(n => n.unresolved.length > 0)).toBe(true);
  });

  it('mixed tiene color, etiqueta y glifo propios', () => {
    expect(COLORS.mixed).toBeTruthy();
    expect(LABELS.mixed).toBe('Mixto');
    expect(GLYPHS.mixed).toBeTruthy();
  });
});
