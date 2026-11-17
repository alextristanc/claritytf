import { describe, it, expect } from 'vitest';
import { splitValues } from '../details';

describe('splitValues', () => {
  it('separa los null y conserva el resto en orden', () => {
    const { known, withoutValue } = splitValues({ a: 1, b: null, c: 'x' });
    expect(known).toEqual([['a', 1], ['c', 'x']]);
    expect(withoutValue).toEqual(['b']);
  });

  it('oculta arrays vacíos y agrupa los null', () => {
    const { known, withoutValue } = splitValues({ vacio: [], lleno: [1], nulo: null });
    expect(known).toEqual([['lleno', [1]]]);
    expect(withoutValue).toEqual(['nulo']);
  });

  it('sin values no produce entradas', () => {
    expect(splitValues(null)).toEqual({ known: [], withoutValue: [] });
    expect(splitValues(undefined)).toEqual({ known: [], withoutValue: [] });
  });

  it('conserva false, 0 y cadena vacía', () => {
    const { known } = splitValues({ f: false, z: 0, s: '' });
    expect(known).toEqual([['f', false], ['z', 0], ['s', '']]);
  });
});
