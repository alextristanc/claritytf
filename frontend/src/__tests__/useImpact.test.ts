import { describe, it, expect } from 'vitest';
import { dependents } from '../useImpact';

const edges = [
  { from: 'a', to: 'b' }, { from: 'b', to: 'c' }, { from: 'x', to: 'y' },
];

describe('dependents', () => {
  it('incluye el recurso y sus dependientes indirectos', () => {
    expect([...dependents(edges, 'a')].sort()).toEqual(['a', 'b', 'c']);
  });
  it('un recurso sin dependientes solo se incluye a sí mismo', () => {
    expect([...dependents(edges, 'c')]).toEqual(['c']);
  });
  it('no se cuelga con ciclos', () => {
    const cyc = [{ from: 'a', to: 'b' }, { from: 'b', to: 'a' }];
    expect([...dependents(cyc, 'a')].sort()).toEqual(['a', 'b']);
  });
});