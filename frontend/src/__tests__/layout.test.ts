import { describe, it, expect } from 'vitest';
import { layout } from '../layout';
import { getDemo } from '../demos';

describe('layout', () => {
  it('asigna caja positiva a cada nodo y módulo y contiene a los hijos', async () => {
    const model = getDemo('mixto').model;
    const boxes = await layout(model);

    for (const n of model.nodes) {
      const b = boxes.get(n.id);
      expect(b, `sin caja para el nodo ${n.id}`).toBeDefined();
      expect(b!.width).toBeGreaterThan(0);
      expect(b!.height).toBeGreaterThan(0);
    }

    for (const m of model.modules) {
      const b = boxes.get(m.id);
      expect(b, `sin caja para el módulo ${m.id}`).toBeDefined();
      expect(b!.width).toBeGreaterThan(0);
      expect(b!.height).toBeGreaterThan(0);
    }

    // Las coordenadas de un hijo son relativas a su padre: debe caber dentro.
    for (const n of model.nodes) {
      if (n.module === null) continue;
      const parent = boxes.get(n.module)!;
      const child = boxes.get(n.id)!;
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.width + 0.5);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.height + 0.5);
    }

    for (const m of model.modules) {
      if (m.parent === null) continue;
      const parent = boxes.get(m.parent)!;
      const child = boxes.get(m.id)!;
      expect(child.x).toBeGreaterThanOrEqual(0);
      expect(child.y).toBeGreaterThanOrEqual(0);
      expect(child.x + child.width).toBeLessThanOrEqual(parent.width + 0.5);
      expect(child.y + child.height).toBeLessThanOrEqual(parent.height + 0.5);
    }
  });
});
