import { useState, useCallback, useEffect } from 'react';
import { loadGame, saveGame, isAutoSaveEnabled, setAutoSaveEnabled, listSaves, deleteSave } from '../../engine/saveSystem';

interface SaveRefs {
  provincesRef: any;
  countriesRef: any;
  armiesRef: any;
  warsRef: any;
  diplomaticRelationsRef: any;
  recruitmentsRef: any;
  buildingConstructionsRef: any;
  playerTechStateRef: any;
  botTechStatesRef: any;
  activeBattlesRef: any;
  dateRef: any;
}

interface SaveSetters {
  setProvinces: (v: any) => void;
  setAllCountries: (v: any) => void;
  setArmies: (v: any) => void;
  setWars: (v: any) => void;
  setDiplomaticRelations: (v: any) => void;
  setRecruitments: (v: any) => void;
  setBuildingConstructions: (v: any) => void;
  setPlayerTechState: (v: any) => void;
  setBotTechStates: (v: any) => void;
  setActiveBattles: (v: any) => void;
  setDate: (v: any) => void;
}

export function useSaveSystem(refs: SaveRefs, setters: SaveSetters, addToast: any, setShowSettingsModal?: (v: boolean) => void) {
  const [autoSaveEnabled, setAutoSaveEnabledState] = useState(() => isAutoSaveEnabled());
  const [saves, setSaves] = useState(() => listSaves());
  const refreshSaves = useCallback(() => setSaves(listSaves()), []);

  // Load autosave ao iniciar
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('newgame') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }
    const saved = loadGame('autosave');
    if (saved) {
      setters.setProvinces(saved.provinces);
      setters.setAllCountries(saved.countries);
      setters.setArmies(saved.armies);
      setters.setWars(saved.wars);
      setters.setDiplomaticRelations(saved.relations);
      setters.setRecruitments(saved.recruitments);
      setters.setBuildingConstructions(saved.constructions);
      setters.setPlayerTechState(saved.playerTech);
      setters.setBotTechStates(saved.botTechs);
      setters.setActiveBattles(saved.activeBattles);
      setters.setDate(saved.date);
      addToast('💾 Autosave carregado!', 'success');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleManualSave = useCallback((customName: string) => {
    const slot = Date.now().toString();
    saveGame(refs, slot, customName);
    refreshSaves();
    addToast(`💾 Save "${customName}" criado!`, 'success');
  }, [refs, refreshSaves, addToast]);

  const handleLoad = useCallback((slotId: string) => {
    const saved = loadGame(slotId);
    if (!saved) {
      addToast('Save não encontrado', 'error');
      return;
    }
    setters.setProvinces(saved.provinces);
    setters.setAllCountries(saved.countries);
    setters.setArmies(saved.armies);
    setters.setWars(saved.wars);
    setters.setDiplomaticRelations(saved.relations);
    setters.setRecruitments(saved.recruitments);
    setters.setBuildingConstructions(saved.constructions);
    setters.setPlayerTechState(saved.playerTech);
    setters.setBotTechStates(saved.botTechs);
    setters.setActiveBattles(saved.activeBattles);
    setters.setDate(saved.date);
    addToast(`📂 Save carregado!`, 'success');
    setShowSettingsModal?.(false);
  }, [setters, addToast, setShowSettingsModal]);

  const handleDelete = useCallback((slotId: string) => {
    if (!confirm(`Apagar ${slotId}?`)) return;
    deleteSave(slotId);
    refreshSaves();
    addToast('🗑️ Save apagado', 'info');
  }, [refreshSaves, addToast]);

  const handleToggleAutoSave = useCallback((v: boolean) => {
    setAutoSaveEnabled(v);
    setAutoSaveEnabledState(v);
    addToast(v? 'Autosave ligado' : 'Autosave desligado', 'info');
  }, [addToast]);

  return { saves, autoSaveEnabled, refreshSaves, handleManualSave, handleLoad, handleDelete, handleToggleAutoSave };
}