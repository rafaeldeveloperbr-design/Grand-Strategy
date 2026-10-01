// src/engine/saveSystem.ts - V2 Tipado e Versionado

import type { Province, Country, GameDate, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../types';
import type { CountryTechState } from '../types/technology';
import type { DiplomaticRelation, War } from '../types/diplomacy';

// ============ TIPOS V1 (legado - pra migração) ============
export type SaveGameV1 = {
  version?: 1;
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  wars: War[];
  relations: DiplomaticRelation[];
  recruitments: Recruitment[];
  constructions: BuildingConstruction[];
  playerTech: CountryTechState;
  botTechs: Map<string, CountryTechState> | Record<string, CountryTechState>;
  activeBattles: ActiveBattle[];
};

// ============ TIPOS V2 (novo - agrupado por domínio) ============
export type SaveGameV2 = {
  version: 2;
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;

  world: {
    provinces: Province[];
    countries: Country[];
  };

  military: {
    armies: Army[];
    wars: War[];
    activeBattles: ActiveBattle[];
    recruitments: Recruitment[];
  };

  diplomacy: {
    relations: DiplomaticRelation[];
  };

  economy: {
    constructions: BuildingConstruction[];
  };

  technology: {
    player: CountryTechState;
    bots: Map<string, CountryTechState>; // Mantido como Map em memória, serializado como array
  };
};

// Payload serializado (como vai pro localStorage - Map virado em array)
type SerializedSaveGameV2 = Omit<SaveGameV2, 'technology'> & {
  technology: {
    player: CountryTechState;
    bots: [string, CountryTechState][]; // Map serializado
  };
};

export type AnySaveGame = SaveGameV1 | SaveGameV2;
export type LatestSaveGame = SaveGameV2;

const SAVE_PREFIX = 'imperium_save_';
const AUTO_SAVE_KEY = 'autosave';
const AUTO_SAVE_ENABLED_KEY = 'imperium_autosave_enabled';
const CURRENT_VERSION = 2 as const;

// ============ SERIALIZAÇÃO ============
function serializeV2(save: SaveGameV2): SerializedSaveGameV2 {
  return {
    ...save,
    technology: {
      player: save.technology.player,
      bots: Array.from(save.technology.bots.entries()),
    },
  };
}

function deserializeV2(raw: SerializedSaveGameV2): SaveGameV2 {
  return {
    ...raw,
    technology: {
      player: raw.technology.player,
      bots: new Map(raw.technology.bots),
    },
  };
}

// ============ MIGRAÇÃO V1 -> V2 ============
function migrateV1ToV2(v1: SaveGameV1): SaveGameV2 {
  const botTechsMap = v1.botTechs instanceof Map 
    ? v1.botTechs 
    : new Map(Object.entries(v1.botTechs as Record<string, CountryTechState>));

  return {
    version: 2,
    id: v1.id,
    name: v1.name,
    timestamp: v1.timestamp,
    date: v1.date,
    world: {
      provinces: v1.provinces,
      countries: v1.countries,
    },
    military: {
      armies: v1.armies,
      wars: v1.wars,
      activeBattles: v1.activeBattles,
      recruitments: v1.recruitments,
    },
    diplomacy: {
      relations: v1.relations,
    },
    economy: {
      constructions: v1.constructions,
    },
    technology: {
      player: v1.playerTech,
      bots: botTechsMap,
    },
  };
}

// ============ LOAD COM DETECÇÃO DE VERSÃO ============
function parseRawSave(rawString: string): SaveGameV2 | null {
  try {
    const raw = JSON.parse(rawString);
    
    // Sem versão = V1
    if (!raw.version || raw.version === 1) {
      return migrateV1ToV2(raw as SaveGameV1);
    }

    if (raw.version === 2) {
      return deserializeV2(raw as SerializedSaveGameV2);
    }

    console.warn(`Save com versão desconhecida: ${raw.version}`);
    return null;
  } catch (e) {
    console.error('Erro ao parsear save', e);
    return null;
  }
}

// ============ API PÚBLICA ============
type SaveGameRefs = {
  provincesRef: { current: Province[] };
  countriesRef: { current: Country[] };
  armiesRef: { current: Army[] };
  warsRef: { current: War[] };
  diplomaticRelationsRef: { current: DiplomaticRelation[] };
  recruitmentsRef: { current: Recruitment[] };
  buildingConstructionsRef: { current: BuildingConstruction[] };
  playerTechStateRef: { current: CountryTechState };
  botTechStatesRef: { current: Map<string, CountryTechState> };
  activeBattlesRef: { current: ActiveBattle[] };
  dateRef: { current: GameDate };
};

export function saveGame(refs: SaveGameRefs, slotId: string, customName?: string) {
  const now = Date.now();
  
  const save: SaveGameV2 = {
    version: CURRENT_VERSION,
    id: slotId,
    name: customName || `Save ${new Date(now).toLocaleString('pt-BR')}`,
    timestamp: now,
    date: refs.dateRef.current,
    world: {
      provinces: refs.provincesRef.current,
      countries: refs.countriesRef.current,
    },
    military: {
      armies: refs.armiesRef.current,
      wars: refs.warsRef.current,
      activeBattles: refs.activeBattlesRef.current,
      recruitments: refs.recruitmentsRef.current,
    },
    diplomacy: {
      relations: refs.diplomaticRelationsRef.current,
    },
    economy: {
      constructions: refs.buildingConstructionsRef.current,
    },
    technology: {
      player: refs.playerTechStateRef.current,
      bots: refs.botTechStatesRef.current,
    },
  };

  const serialized = serializeV2(save);
  localStorage.setItem(SAVE_PREFIX + slotId, JSON.stringify(serialized));
  
  // Se for autosave, atualiza lista também
  if (slotId === AUTO_SAVE_KEY) {
    localStorage.setItem(SAVE_PREFIX + AUTO_SAVE_KEY, JSON.stringify(serialized));
  }
}

// Retorna sempre no formato V2 (já migrado) mas mantém compatibilidade com seu App.tsx
// Seu useSaveSystem espera .provinces, .countries etc? Vamos retornar híbrido por enquanto
export function loadGame(slotId: string): SaveGameV2 | null {
  const rawString = localStorage.getItem(SAVE_PREFIX + slotId);
  if (!rawString) return null;

  const v2 = parseRawSave(rawString);
  if (!v2) return null;

  return v2; // já é V2 puro, migrado se precisou
} 
    
  

export type SaveListItem = {
  id: string;
  name: string;
  timestamp: number;
  date: GameDate;
  version: number;
};

export function listSaves(): SaveListItem[] {
  const saves: SaveListItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(SAVE_PREFIX)) continue;
    if (key === SAVE_PREFIX + AUTO_SAVE_KEY) continue; // não lista autosave na lista manual
    if (key === AUTO_SAVE_ENABLED_KEY) continue;

    try {
      const raw = localStorage.getItem(key)!;
      const parsed = JSON.parse(raw);
      saves.push({
        id: parsed.id || key.replace(SAVE_PREFIX, ''),
        name: parsed.name || key,
        timestamp: parsed.timestamp || 0,
        date: parsed.date,
        version: parsed.version || 1,
      });
    } catch (e){
      console.warn(`[SaveSystem] Save corrompido ignorado: ${key}`, e);
    }
  }
  return saves.sort((a, b) => b.timestamp - a.timestamp);
}

export function deleteSave(slotId: string) {
  localStorage.removeItem(SAVE_PREFIX + slotId);
}

export function clearAllSaves() {
  listSaves().forEach(s => deleteSave(s.id));
  localStorage.removeItem(SAVE_PREFIX + AUTO_SAVE_KEY);
}

export function isAutoSaveEnabled(): boolean {
  const v = localStorage.getItem(AUTO_SAVE_ENABLED_KEY);
  return v === null ? true : v === 'true';
}

export function setAutoSaveEnabled(v: boolean) {
  localStorage.setItem(AUTO_SAVE_ENABLED_KEY, String(v));
}