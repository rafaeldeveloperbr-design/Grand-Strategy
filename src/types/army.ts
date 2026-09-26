import type { GameDate } from './date'


/**
 * ============================================================
 * MÓDULO 3 - Tipos Militares
 * ============================================================
 */

/**
 * Tipos de unidades militares
 */
export type UnitType = 'infantry' | 'cavalry' | 'artillery' | 'archers' | 'heavy_cavalry' | 'elite_guard' | 'siege_engine';

/**
 * Definição de um tipo de unidade militar
 */
export interface UnitDefinition {
  type: UnitType;
  name: string;
  icon: string;
  /** Custo em ouro por regimento (1000 homens) */
  cost: number;
  /** Custo em manpower por regimento */
  manpowerCost: number;
  /** Dias de treinamento */
  trainingTime: number;
  /** Poder de ataque base */
  attack: number;
  /** Poder de defesa base */
  defense: number;
  /** Mobilidade (províncias por dia) */
  mobility: number;
}

/**
 * Representa um regimento militar (unidade básica)
 */
export interface Regiment {
  type: UnitType;
  /** Número de homens no regimento (máx 1000) */
  strength: number;
  /** Moral (0-100) */
  morale: number;
}

/**
 * Representa um exército (coleção de regimentos)
 */
export interface Army {
  /** ID único do exército */
  id: string;
  /** País dono do exército */
  owner: string;
  /** Nome do exército */
  name: string;
  /** Lista de regimentos */
  regiments: Regiment[];
  /** Província atual (null se em movimento) */
  location: string | null;
  /** Próximo passo imediato da rota */
  destination: string | null;
  /** Destino final selecionado pelo jogador */
  targetDestination: string | null;
  /** Progresso do movimento (0-1, onde 1 = chegou) */
  movementProgress: number;
  /** Velocidade de movimento (baseada no regimento mais lento) */
  movementSpeed: number;
  /** Posição visual atual (para animação) */
  position: { x: number; y: number } | null;
  /** Lista de províncias a percorrer em ordem (rota completa) */
  path: string[];
  /** ID do exército alvo (Target Locking - IA mantém foco até eliminar) */
  targetArmyId?: string | null;
  /** ID da província alvo de invasão (Target Locking de invasão - IA marcha em linha reta) */
  targetProvinceId?: string | null;
  /** Indica se o exército está em combate (bloqueia movimento) */
  inCombat?: boolean;
  originalOwner?: string; // País de origem dos rebeldes (para IA separatista)
  separatistMode?: boolean; // Flag para ativar a marcha de reconquista

}

/**
 * Representa um recrutamento em andamento
 */
export interface Recruitment {
  /** ID único */
  id: string;
  /** Província onde está recrutando */
  provinceId: string;
  /** País que está recrutando */
  owner: string;
  /** Tipo de unidade sendo recrutada */
  unitType: UnitType;
  /** Dias restantes */
  daysRemaining: number;
  /** Quantidade de unidades sendo recrutadas (agrupamento) */
  count: number;
}

/**
 * Resultado de um combate
 */
export interface CombatResult {
  /** Exército atacante */
  attacker: Army;
  /** Exército defensor */
  defender: Army;
  /** Exército atacante original (antes do combate) */
  attackerOriginal: Army;
  /** Exército defensor original (antes do combate) */
  defenderOriginal: Army;
  /** Baixas do atacante */
  attackerCasualties: number;
  /** Baixas do defensor */
  defenderCasualties: number;
  /** Vencedor ('attacker' ou 'defender') */
  winner: 'attacker' | 'defender';
  /** Província onde ocorreu o combate */
  provinceId: string;
  /** Nome da província */
  provinceName: string;
  /** Duração do combate em dias */
  duration: number;
  /** Se houve mudança territorial */
  territoryChanged: boolean;
  /** Novo dono da província (se mudou) */
  newOwner?: string;
  /** Se o defensor teve bônus de defesa territorial */
  territorialDefenseBonus: boolean;
  /** Ratio de poder (Vencedor / Perdedor) */
  powerRatio: number;
  /** Data em que a batalha ocorreu */
  date: GameDate;
}