/**
 * useArmyActions.ts - CORRIGIDO
 */
import { useCallback } from 'react';
import { moveArmy, mergeArmies, splitArmy, splitArmyHalf, stopArmyMovement } from '../../engine/military';
import { calculateArmySize } from '../../engine/combat';

export function useArmyActions(params: any) {
  const { selectedArmy, provincesRef, armiesRef, diplomaticRelationsRef, playerCountryTag, setArmies, addLog, addToast, splitSelection, setSplitSelection, setShowSplitModal } = params;

  const handleProvinceRightClick = useCallback((provinceId: string) => {
    if (!selectedArmy) return;
    const army = armiesRef.current.find((a: any) => a.id === selectedArmy);
    if (!army || army.owner !== playerCountryTag) return;
    if (army.destination && army.location === provinceId) {
      const updatedArmy = stopArmyMovement(army);
      if (updatedArmy !== army) {
        setArmies((prev: any) => prev.map((a: any) => a.id === army.id ? updatedArmy : a));
        const currentProvince = provincesRef.current.find((p: any) => p.id === provinceId);
        addLog(`🛑 ${army.name} parou em ${currentProvince?.name ?? provinceId}`);
        addToast(`Exército parou em ${currentProvince?.name ?? provinceId}`, 'info', 'Movimento Cancelado');
      }
      return;
    }
    if (army.destination) return;
    const moved = moveArmy(army, provinceId, provincesRef.current, diplomaticRelationsRef.current);
    if (moved) {
      setArmies((prev: any) => prev.map((a: any) => a.id === army.id ? moved : a));
      const destProvince = provincesRef.current.find((p: any) => p.id === provinceId);
      addLog(`🚶 ${army.name} marchando para ${destProvince?.name ?? provinceId}`);
    } else {
      addLog(`❌ Movimento não permitido`);
    }
  }, [selectedArmy, playerCountryTag, addLog, addToast, armiesRef, diplomaticRelationsRef, provincesRef, setArmies]);

  const handleMergeArmies = useCallback((targetArmyId: string) => {
    if (!selectedArmy) return;
    const army1 = armiesRef.current.find((a: any) => a.id === selectedArmy);
    const army2 = armiesRef.current.find((a: any) => a.id === targetArmyId);
    if (!army1 || !army2) return;
    if (army1.owner !== playerCountryTag || army2.owner !== playerCountryTag) return;
    if (army1.location !== army2.location) return;
    if (army1.destination || army2.destination) return;
    const merged = mergeArmies(army1, army2);
    setArmies((prev: any) => { const filtered = prev.filter((a: any) => a.id !== army1.id && a.id !== army2.id); return [...filtered, merged]; });
    addLog(`🤝 ${army1.name} + ${army2.name} fundidos (${calculateArmySize(merged).toLocaleString()} homens)`);
  }, [selectedArmy, playerCountryTag, addLog, armiesRef, setArmies]);

  const handleSplitHalf = useCallback(() => {
    if (!selectedArmy) return;
    const army = armiesRef.current.find((a: any) => a.id === selectedArmy);
    if (!army || army.owner !== playerCountryTag || army.destination) return;
    const newArmy = splitArmyHalf(army, `${army.name} (Destacamento)`);
    if (!newArmy) return;
    const halfIndex = Math.floor(army.regiments.length / 2);
    const remainingRegiments = army.regiments.slice(halfIndex);
    setArmies((prev: any) => { const filtered = prev.filter((a: any) => a.id !== army.id); return [...filtered, { ...army, regiments: remainingRegiments }, newArmy]; });
    addLog(`✂️ ${army.name} dividido`);
  }, [selectedArmy, playerCountryTag, addLog, armiesRef, setArmies]);

  const handleSplitCustom = useCallback(() => {
    if (!selectedArmy || splitSelection.size === 0) return;
    const army = armiesRef.current.find((a: any) => a.id === selectedArmy);
    if (!army || army.owner !== playerCountryTag || army.destination) return;
    const indices = [...splitSelection] as number[];
    const newArmy = splitArmy(army, indices, `${army.name} (Destacamento)`);
    if (!newArmy) return;
    const remainingRegiments = army.regiments.filter((_: any, idx: number) => !splitSelection.has(idx));
    setArmies((prev: any) => { const filtered = prev.filter((a: any) => a.id !== army.id); return [...filtered, { ...army, regiments: remainingRegiments }, newArmy]; });
    setShowSplitModal(false); setSplitSelection(new Set());
    addLog(`✂️ ${army.name} dividido customizado`);
  }, [selectedArmy, splitSelection, playerCountryTag, addLog, armiesRef, setArmies, setShowSplitModal, setSplitSelection]);

  const handleRetreatArmy = useCallback((armyId: string, battleId: string) => {
    params.setArmies((prev: any) => prev.map((a: any) => a.id === armyId ? { ...a, isRetreating: true } : a));
    addLog(`🏃 Exército ${armyId} recuando`);
  }, [params, addLog]);

  const handleStopMovement = useCallback((armyId: string) => {
    const army = armiesRef.current.find((a: any) => a.id === armyId);
    if (!army) return;
    const stopped = stopArmyMovement(army);
    setArmies((prev: any) => prev.map((a: any) => a.id === armyId ? stopped : a));
  }, [armiesRef, setArmies]);

  return { handleProvinceRightClick, handleMergeArmies, handleSplitHalf, handleSplitCustom, handleRetreatArmy, handleStopMovement };
}
