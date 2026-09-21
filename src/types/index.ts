/**
 * ============================================================
 * MÓDULO 1 + 2 - Tipos e Interfaces do Jogo de Grande Estratégia
 * ============================================================
 * Define as estruturas de dados fundamentais para províncias,
 * países, economia, construções e estado do jogo.
 */

/**
 * Tipos de edifícios disponíveis para construção
 */
export type BuildingType = 'farm' | 'market' | 'barracks' | 'fortification';

/**
 * Representa um edifício em construção ou já construído
 */
export interface Building {
  /** Tipo do edifício */
  type: BuildingType;
  /** Nível do edifício (1-5) */
  level: number;
  /** Dias restantes para conclusão (0 = pronto) */
  daysRemaining: number;
}

/**
 * Representa uma província/região no mapa do jogo.
 * Cada província é uma entidade territorial básica.
 */
export interface Province {
  /** Identificador único da província */
  id: string;
  /** Nome exibido da província */
  name: string;
  /** ID do país que controla esta província */
  owner: string;
  /** Cor de renderização (herdada do país, mas pode ser sobrescrita) */
  color: string;
  /** Lista de IDs de províncias vizinhas (conexões de fronteira) */
  neighbors: string[];
  /** População atual da província */
  population: number;
  /** População máxima suportada */
  maxPopulation: number;
  /** Nível de desenvolvimento base (1-10) */
  development: number;
  /** Lista de edifícios na província */
  buildings: Building[];
  /** Valor defensivo (base + fortificações) */
  defense: number;
  /** Coordenadas do centro da província para tooltip */
  center: { x: number; y: number };
  /** Path SVG da província */
  path: string;
}

/**
 * Representa uma nação/país jogável ou não-jogável.
 */
export interface Country {
  /** Tag única do país (ex: "BRA", "FRA", "GER") */
  tag: string;
  /** Nome completo do país */
  name: string;
  /** Nome curto/adietivo */
  adjective: string;
  /** Cor principal no mapa (hex) */
  color: string;
  /** Cor secundária para destaques */
  colorLight: string;
  /** Lista de IDs de províncias controladas */
  provinces: string[];
  /** Recursos do país */
  resources: CountryResources;
  /** Taxas econômicas (renda/despesas por dia) */
  economy: CountryEconomy;
  /** Bandeira (emoji ou ícone) */
  flag: string;
}

/**
 * Recursos globais de um país
 */
export interface CountryResources {
  /** Ouro/moeda do país */
  gold: number;
  /** Mão de obra disponível (recrutável) */
  manpower: number;
  /** Mão de obra máxima (baseada na população elegível) */
  maxManpower: number;
  /** Estabilidade política (0-100) */
  stability: number;
  /** Prestígio militar */
  prestige: number;
}

/**
 * Taxas econômicas do país (calculadas a cada tick)
 */
export interface CountryEconomy {
  /** Renda bruta de ouro por dia */
  goldIncome: number;
  /** Despesas de manutenção por dia */
  goldExpense: number;
  /** Ganho de manpower por dia */
  manpowerGain: number;
  /** Custo de manutenção de tropas por dia */
  manpowerExpense: number;
}

/**
 * Definição de um tipo de edifício (template)
 */
export interface BuildingDefinition {
  /** Tipo do edifício */
  type: BuildingType;
  /** Nome exibido */
  name: string;
  /** Descrição */
  description: string;
  /** Ícone visual */
  icon: string;
  /** Custo base em ouro */
  baseCost: number;
  /** Multiplicador de custo por nível */
  costMultiplier: number;
  /** Dias de construção base */
  baseBuildTime: number;
  /** Nível máximo */
  maxLevel: number;
  /** Bônus por nível */
  bonusPerLevel: BuildingBonus;
}

/**
 * Bônus concedidos por um edifício
 */
export interface BuildingBonus {
  /** Bônus de renda de ouro */
  goldIncome?: number;
  /** Bônus de manpower */
  manpowerGain?: number;
  /** Bônus de defesa */
  defense?: number;
  /** Bônus de crescimento populacional (%) */
  growthBonus?: number;
}

/**
 * Estado global do jogo
 */
export interface GameState {
  /** Mapa de todas as províncias */
  provinces: Map<string, Province>;
  /** Lista de todos os países */
  countries: Country[];
  /** Tag do país do jogador */
  playerCountry: string;
  /** Data/turno atual */
  date: GameDate;
  /** Província atualmente selecionada */
  selectedProvince: string | null;
  /** Província sob o cursor */
  hoveredProvince: string | null;
  /** Velocidade do jogo (0 = pausado, 1-5 = velocidades) */
  gameSpeed: number;
}

/**
 * Representa a data no jogo
 */
export interface GameDate {
  year: number;
  month: number;
  day: number;
}
