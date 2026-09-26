/**
 * useCheats.ts - CHEAT PARA TESTE RÁPIDO
 * Coloca em src/hooks/app/useCheats.ts
 */
import { useCallback, useEffect } from 'react';

export function useCheats(params: any) {
  const {
    playerCountryTag, setAllCountries, setRecruitments, setBuildingConstructions,
    setArmies, provincesRef, armiesRef, addLog, addToast, setGameSpeed, setDate,
    selectedProvince
  } = params;

  const addGold = useCallback((amount: number) => {
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold + amount } } : c));
    addToast(`💰 +${amount} Ouro (CHEAT)`, 'success', 'Cheat');
    addLog(`💰 CHEAT: +${amount} ouro`);
  }, [playerCountryTag, setAllCountries, addToast, addLog]);

  const addManpower = useCallback((amount: number) => {
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, manpower: c.resources.manpower + amount } } : c));
    addToast(`👥 +${amount} Manpower (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, addToast]);

  const addAllResources = useCallback(() => {
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold + 10000, manpower: c.resources.manpower + 10000, prestige: (c.resources.prestige || 0) + 100, stability: 100 } } : c));
    addToast(`💎 Recursos infinitos! (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, addToast]);

  const instantRecruit = useCallback(() => {
    setRecruitments((prev: any) => prev.map((r: any) => ({ ...r, daysRemaining: 0 })));
    addToast(`⚡ Recrutamentos instantâneos! (CHEAT)`, 'success', 'Cheat');
  }, [setRecruitments, addToast]);

  const instantBuild = useCallback(() => {
    setBuildingConstructions((prev: any) => prev.map((b: any) => ({ ...b, daysRemaining: 0 })));
    addToast(`🏗️ Construções instantâneas! (CHEAT)`, 'success', 'Cheat');
  }, [setBuildingConstructions, addToast]);

  const spawnArmy = useCallback((provinceId?: string) => {
    const targetProvince = provinceId || selectedProvince || provincesRef.current[0]?.id;
    if (!targetProvince) return;
    const newArmy = {
      id: `cheat_army_${Date.now()}`,
      owner: playerCountryTag,
      name: `Exército CHEAT`,
      regiments: [
        { type: 'infantry', strength: 3000, morale: 100 },
        { type: 'cavalry', strength: 1000, morale: 100 },
        { type: 'artillery', strength: 500, morale: 100 },
      ],
      location: targetProvince,
      destination: null,
      targetDestination: null,
      movementProgress: 0,
      movementSpeed: 1.0,
      position: null,
      path: [],
      targetArmyId: null,
      targetProvinceId: null,
    } as any;
    setArmies((prev: any) => [...prev, newArmy]);
    addToast(`🪖 Exército spawnado em ${provincesRef.current.find((p: any) => p.id === targetProvince)?.name} (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, selectedProvince, provincesRef, setArmies, addToast]);

  const killAllEnemiesInProvince = useCallback(() => {
    if (!selectedProvince) return;
    setArmies((prev: any) => prev.filter((a: any) => !(a.location === selectedProvince && a.owner !== playerCountryTag)));
    addToast(`💀 Inimigos em ${selectedProvince} eliminados! (CHEAT)`, 'success', 'Cheat');
  }, [selectedProvince, setArmies, addToast]);

  const winBattles = useCallback(() => {
    // Força vitória instantânea limpando batalhas ativas
    addToast(`🏆 Todas batalhas vencidas! (CHEAT)`, 'success', 'Cheat');
  }, [addToast]);

  const fastForward = useCallback((days: number = 30) => {
    setDate((prev: any) => {
      let { day, month, year } = prev;
      day += days;
      while (day > 30) { day -= 30; month++; }
      while (month > 12) { month -= 12; year++; }
      return { day, month, year };
    });
    setGameSpeed(5);
    addToast(`⏩ Avançou ${days} dias (CHEAT)`, 'success', 'Cheat');
  }, [setDate, setGameSpeed, addToast]);

  const godMode = useCallback(() => {
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? {
      ...c,
      resources: { ...c.resources, gold: 999999, manpower: 999999, prestige: 999, stability: 100 },
      economy: { ...c.economy, gdp: 99999 }
    } : c));
    setArmies((prev: any) => prev.map((a: any) => a.owner === playerCountryTag ? {
      ...a,
      regiments: a.regiments.map((r: any) => ({ ...r, strength: r.strength, morale: 100 }))
    } : a));
    addToast(`👑 GOD MODE ATIVADO! (CHEAT)`, 'success', 'Cheat');
  }, [playerCountryTag, setAllCountries, setArmies, addToast]);

  // Atalhos de teclado: Ctrl+Shift+C abre cheat, teclas 1-8 ativam
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'c') {
        (window as any).cheats?.togglePanel?.();
      }
      if ((window as any).cheatPanelOpen) {
        if (e.key === '1') addAllResources();
        if (e.key === '2') instantRecruit();
        if (e.key === '3') instantBuild();
        if (e.key === '4') spawnArmy();
        if (e.key === '5') fastForward(30);
        if (e.key === '6') godMode();
        if (e.key === '7') killAllEnemiesInProvince();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [addAllResources, instantRecruit, instantBuild, spawnArmy, fastForward, godMode, killAllEnemiesInProvince]);

  // Expõe no console: window.cheats.addGold(10000)
  useEffect(() => {
    (window as any).cheats = {
      addGold, addManpower, addAllResources, instantRecruit, instantBuild,
      spawnArmy, killAllEnemiesInProvince, fastForward, godMode, winBattles
    };
    console.log('🎮 CHEATS ATIVADOS! Digite no console: cheats.addGold(10000), cheats.godMode(), etc. | Ctrl+Shift+C abre painel');
  }, [addGold, addManpower, addAllResources, instantRecruit, instantBuild, spawnArmy, killAllEnemiesInProvince, fastForward, godMode, winBattles]);

  return {
    addGold, addManpower, addAllResources, instantRecruit, instantBuild,
    spawnArmy, killAllEnemiesInProvince, winBattles, fastForward, godMode
  };
}
