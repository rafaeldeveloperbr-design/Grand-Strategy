export type EffectType =
  | 'COMBAT_POWER'
  | 'GOLD_INCOME'
  | 'BUILD_COST'
  | 'BUILD_TIME'
  | 'MANPOWER'
  | 'STABILITY'
  | 'RESEARCH_SPEED';

export interface RewardEffect {
  type: EffectType;
  value: number;
  unitType?: 'infantry' | 'cavalry' | 'artillery';
}

// Interface para Focos Nacionais
export interface NationalFocus {
  id: string;
  title: string;
  description: string;
  icon: string;
  durationDays: number;
  currentProgressDays: number;
  completed: boolean;
  rewardEffect: RewardEffect;
  prerequisites?: string[];
}

// Categoria exclusiva de Pesquisa
export type ResearchCategory = 'MILITARY' | 'ECONOMY' | 'INFRASTRUCTURE';

// Interface para Pesquisas
export interface ResearchItem {
  id: string;
  title: string;
  description: string;
  category: ResearchCategory;
  icon: string;
  costGold: number;
  durationDays: number;
  currentProgressDays: number;
  researched: boolean;
  prerequisites?: string[];
  rewardEffect: RewardEffect;
}