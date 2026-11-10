import { describe, expect, it } from 'vitest';
import { dividirEnBloques, paginasVisibles } from './paginacion';

describe('dividirEnBloques', () => {
  it('divide en bloques del tamaño pedido', () => {
    expect(dividirEnBloques([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(dividirEnBloques([], 4)).toEqual([]);
  });

  it('un tamaño inválido no produce bloques', () => {
    expect(dividirEnBloques([1, 2], 0)).toEqual([]);
  });
});

describe('paginasVisibles', () => {
  it('muestra las páginas del grupo actual', () => {
    expect(paginasVisibles(10, 0)).toEqual([0, 1, 2, 3]);
    expect(paginasVisibles(10, 5)).toEqual([4, 5, 6, 7]);
    expect(paginasVisibles(10, 9)).toEqual([8, 9]);
    expect(paginasVisibles(2, 1)).toEqual([0, 1]);
  });
});
