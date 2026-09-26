/**
 * useTechActions.ts - CORRIGIDO - assinaturas reais
 */
import { useCallback } from 'react';
import { startNationalFocus, startTechnologyResearch } from '../../engine/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technologies';
import { LAWS } from '../../constants/laws';

export function useTechActions(params: any) {
  const { playerCountry, playerCountryTag, playerTechState, setPlayerTechState, allCountries, setAllCountries, addLog, addToast, playerTechStateRef, setAiDifficulty, setEndGameType, setGameStats, setGameSpeed, setIsPaused } = params;

  const handleStartFocus = useCallback((focusId: string) => {
    if (!focusId || !playerTechState) return;
    const updatedTechState = startNationalFocus(playerTechState, focusId);
    if (updatedTechState) {
      setPlayerTechState(updatedTechState);
      if (playerTechStateRef) playerTechStateRef.current = updatedTechState;
      const focus = (NATIONAL_FOCUSES as any)?.find((f: any) => f?.id === focusId);
      if (focus) addLog(`🎯 Foco iniciado: ${focus.title}`);
    }
  }, [playerTechState, addLog, setPlayerTechState, playerTechStateRef]);

  const handleStartResearch = useCallback((techId: string) => {
    if (!techId || !playerTechState || !playerCountry) return;
    const tech = (TECHNOLOGIES as any)?.find((t: any) => t?.id === techId);
    if (!tech) return;
    if (playerCountry.resources.gold < tech.costGold) {
      addLog(`❌ Ouro insuficiente para pesquisar ${tech.title}`);
      return;
    }
    const result = startTechnologyResearch(playerTechState, techId, playerCountry) as any;
    const updatedTechState = result?.techState || result;
    const cost = result?.cost ?? tech.costGold;
    if (updatedTechState) {
      setAllCountries((prev: any) => prev.map((c: any) => c?.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold - cost } } : c));
      setPlayerTechState(updatedTechState);
      if (playerTechStateRef) playerTechStateRef.current = updatedTechState;
      addLog(`🔬 Pesquisa iniciada: ${tech.title} (💰 ${cost})`);
    }
  }, [playerTechState, playerCountry, playerCountryTag, addLog, setAllCountries, setPlayerTechState, playerTechStateRef]);

  const handleEndGameContinue = useCallback(() => { setEndGameType(null); setIsPaused(false); }, [setEndGameType, setIsPaused]);
  const handleEndGameRestart = useCallback(() => window.location.reload(), []);
  const handleDifficultyChange = useCallback((newDifficulty: any) => { setAiDifficulty(newDifficulty); addToast(`Dificuldade: ${newDifficulty}`, 'info', 'Configuração'); }, [setAiDifficulty, addToast]);
  const handleEnactLaw = useCallback((category: any, lawId: string) => {
    const law = (LAWS as any)[lawId];
    if (!law) return;
    if (playerCountry.resources.gold < law.costGold) { addToast('Ouro insuficiente', 'error', 'Erro'); return; }
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold - law.costGold }, activeLaws: { ...c.activeLaws, [category]: lawId } } : c));
    addToast(`Lei "${law.name}" promulgada!`, 'success', 'Nova Lei');
  }, [playerCountry, playerCountryTag, addToast, setAllCountries]);
  const handleSpeedChange = useCallback((speed: number) => setGameSpeed(speed), [setGameSpeed]);

  return { handleStartFocus, handleStartResearch, handleEndGameContinue, handleEndGameRestart, handleDifficultyChange, handleEnactLaw, handleSpeedChange };
}
