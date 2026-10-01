/**
 * useTechActions.ts - 0 
 */
import { useCallback } from 'react';
import { startNationalFocus, startTechnologyResearch } from '../../engine/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../../data/technology';
import { LAWS } from '../../constants/laws';
import type { Country } from '../../types';

type TechState = any;
type LawEntry = { name: string; costGold: number };

type LawsMap = Record<string, LawEntry>;

type TechResult =
  | TechState
  | { techState: TechState; cost: number };

export function useTechActions(params: {
  playerCountry: Country;
  playerCountryTag: string;
  playerTechState: TechState;
  setPlayerTechState: (s: TechState) => void;
  allCountries: Country[];
  setAllCountries: React.Dispatch<React.SetStateAction<Country[]>>;
  addLog: (msg: string) => void;
  addToast: (msg: string, type: string, title?: string) => void;
  playerTechStateRef: React.MutableRefObject<TechState>;
  setAiDifficulty: (d: string) => void;
  setEndGameType: (t: string | null) => void;
  setGameStats: (s: any) => void;
  setGameSpeed: (n: number) => void;
  setIsPaused: (b: boolean) => void;
}) {
  const { playerCountry, playerCountryTag, playerTechState, setPlayerTechState, setAllCountries, addLog, addToast, playerTechStateRef, setAiDifficulty, setEndGameType, setGameSpeed, setIsPaused } = params;

  const handleStartFocus = useCallback((focusId: string) => {
    if (!focusId ||!playerTechState) return;
    const updatedTechState = startNationalFocus(playerTechState, focusId);
    if (updatedTechState) {
      setPlayerTechState(updatedTechState);
      if (playerTechStateRef) playerTechStateRef.current = updatedTechState;
      const focus = NATIONAL_FOCUSES.find((f) => f.id === focusId);
      if (focus) addLog(`🎯 Foco iniciado: ${focus.title}`);
    }
  }, [playerTechState, addLog, setPlayerTechState, playerTechStateRef]);

  const handleStartResearch = useCallback((techId: string) => {
    if (!techId ||!playerTechState ||!playerCountry) return;
    const tech = TECHNOLOGIES.find((t) => t.id === techId);
    if (!tech) return;
    if (playerCountry.resources.gold < tech.costGold) {
      addLog(`❌ Ouro insuficiente para pesquisar ${tech.title}`);
      return;
    }
    const result = startTechnologyResearch(playerTechState, techId, playerCountry) as TechResult;

    // Normaliza: pode ser TechState direto ou { techState, cost }
    const updatedTechState = (result as { techState?: TechState })?.techState || (result as TechState);
    const cost = (result as { cost?: number })?.cost?? tech.costGold;

    if (updatedTechState) {
      setAllCountries((prev) => prev.map((c) => c?.tag === playerCountryTag? {...c, resources: {...c.resources, gold: c.resources.gold - cost } } : c));
      setPlayerTechState(updatedTechState);
      if (playerTechStateRef) playerTechStateRef.current = updatedTechState;
      addLog(`🔬 Pesquisa iniciada: ${tech.title} (💰 ${cost})`);
    }
  }, [playerTechState, playerCountry, playerCountryTag, addLog, setAllCountries, setPlayerTechState, playerTechStateRef]);

  const handleEndGameContinue = useCallback(() => { setEndGameType(null); setIsPaused(false); }, [setEndGameType, setIsPaused]);
  const handleEndGameRestart = useCallback(() => window.location.reload(), []);
  const handleDifficultyChange = useCallback((newDifficulty: string) => { setAiDifficulty(newDifficulty); addToast(`Dificuldade: ${newDifficulty}`, 'info', 'Configuração'); }, [setAiDifficulty, addToast]);

  const handleEnactLaw = useCallback((category: string, lawId: string) => {
    const law = (LAWS as LawsMap)[lawId];
    if (!law) return;
    if (playerCountry.resources.gold < law.costGold) { addToast('Ouro insuficiente', 'error', 'Erro'); return; }
    setAllCountries((prev) => prev.map((c) => c.tag === playerCountryTag? {...c, resources: {...c.resources, gold: c.resources.gold - law.costGold }, activeLaws: {...c.activeLaws, [category]: lawId } } : c));
    addToast(`Lei "${law.name}" promulgada!`, 'success', 'Nova Lei');
  }, [playerCountry, playerCountryTag, addToast, setAllCountries]);

  const handleSpeedChange = useCallback((speed: number) => setGameSpeed(speed), [setGameSpeed]);

  return { handleStartFocus, handleStartResearch, handleEndGameContinue, handleEndGameRestart, handleDifficultyChange, handleEnactLaw, handleSpeedChange };
}