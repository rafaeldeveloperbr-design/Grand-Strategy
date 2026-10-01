import { describe, it, expect, beforeEach } from 'vitest';
import { saveGame, loadGame, listSaves } from '../saveSystem';
import type { GameDate } from '../../types';

// Polyfill pra rodar mesmo em Node
if (typeof localStorage === 'undefined') {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    get length() { return store.size; },
    key: (i: number) => Array.from(store.keys())[i] || null,
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
  };
}

describe('SAVE/LOAD', () => {
  beforeEach(() => localStorage.clear());

  it('salvar e carregar preserva data', () => {
    const date: GameDate = { day: 15, month: 6, year: 1836 };
    const refs = {
      dateRef: { current: date },
      provincesRef: { current: [] },
      countriesRef: { current: [] },
      armiesRef: { current: [{ id: 'a1', tag: 'BRA' } as any] },
      warsRef: { current: [] },
      diplomaticRelationsRef: { current: [] },
      recruitmentsRef: { current: [] },
      buildingConstructionsRef: { current: [] },
      playerTechStateRef: { current: { techs: {} } as any },
      botTechStatesRef: { current: new Map() },
      activeBattlesRef: { current: [] },
    } as any;

    saveGame(refs, 'test1', 'Teste');
    const loaded = loadGame('test1');

    expect(loaded?.date).toEqual(date);
    expect(loaded?.military.armies[0].id).toBe('a1');
  });

  it('reconstruir Map de bots', () => {
    const botMap = new Map([['ARG', { points: 100 } as any]]);
    const refs = {
      dateRef: { current: { day: 1, month: 1, year: 1836 } },
      provincesRef: { current: [] },
      countriesRef: { current: [] },
      armiesRef: { current: [] },
      warsRef: { current: [] },
      diplomaticRelationsRef: { current: [] },
      recruitmentsRef: { current: [] },
      buildingConstructionsRef: { current: [] },
      playerTechStateRef: { current: {} as any },
      botTechStatesRef: { current: botMap },
      activeBattlesRef: { current: [] },
    } as any;

    saveGame(refs, 'testMap', 'MapTest');
    const loaded = loadGame('testMap');

    expect(loaded?.technology.bots instanceof Map).toBe(true);
    expect(loaded?.technology.bots.get('ARG')).toBeDefined();
  });
});