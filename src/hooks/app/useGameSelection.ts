/**
 * useGameSelection.ts - 85 linhas - PASSO 5.1
 * Seleção de província, exército, hover e painel
 */
import { useState, useCallback } from 'react';

export function useGameSelection(playerCountryTag: string, provincesRef: any, armiesRef: any, handleOpenDiplomacy: (tag: string) => void) {
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [selectedArmy, setSelectedArmy] = useState<string | null>(null);
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [splitSelection, setSplitSelection] = useState<Set<number>>(new Set());

  const handleProvinceClick = useCallback((provinceId: string) => {
    const province = provincesRef.current.find((p: any) => p.id === provinceId);
    if (province && province.owner !== playerCountryTag) {
      handleOpenDiplomacy(province.owner);
    } else {
      setSelectedProvince(provinceId);
      setIsPanelOpen(true);
      setSelectedArmy(null);
    }
  }, [playerCountryTag, provincesRef, handleOpenDiplomacy]);

  const handleProvinceHover = useCallback((provinceId: string | null) => setHoveredProvince(provinceId), []);
  const handleClosePanel = useCallback(() => { setIsPanelOpen(false); setSelectedProvince(null); }, []);

  const handleArmyClick = useCallback((armyId: string) => {
    const army = armiesRef.current.find((a: any) => a.id === armyId);
    if (army && army.owner === playerCountryTag) {
      setSelectedArmy(armyId);
      setSelectedProvince(null);
      setIsPanelOpen(false);
    }
  }, [playerCountryTag, armiesRef]);

  const toggleSplitRegiment = useCallback((index: number) => {
    setSplitSelection(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index); else next.add(index);
      return next;
    });
  }, []);

  return {
    selectedProvince, setSelectedProvince,
    hoveredProvince, setHoveredProvince,
    isPanelOpen, setIsPanelOpen,
    selectedArmy, setSelectedArmy,
    showSplitModal, setShowSplitModal,
    splitSelection, setSplitSelection,
    handleProvinceClick, handleProvinceHover, handleClosePanel, handleArmyClick, toggleSplitRegiment
  };
}
