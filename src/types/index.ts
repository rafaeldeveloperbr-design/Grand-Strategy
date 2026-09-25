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
export type BuildingType = 'farm' | 'market' | 'barracks' | 'fortification' | 'workshop' | 'temple' | 'port' | 'university';

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
 * Representa uma construção na fila (sistema de fila de construções)
 */
export interface BuildingConstruction {
  /** ID único da construção */
  id: string;
  /** ID da província onde está sendo construída */
  provinceId: string;
  /** Tipo do edifício sendo construído */
  buildingType: BuildingType;
  /** Dias restantes para conclusão */
  daysRemaining: number;
  /** Total de dias necessários para construção */
  totalDays: number;
  /** Custo em ouro da construção */
  cost: number;
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
  /** Leis ativas do país */
  activeLaws: {
    conscription: string;
    taxation: string;
    governance: string;
  };
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
  /** Redução de tempo de recrutamento militar (%) */
  recruitmentSpeedBonus?: number;
  /** Bônus de velocidade de construção (%) */
  buildSpeedBonus?: number;
  /** Bônus de estabilidade por mês */
  stabilityBonus?: number;
  /** Bônus de velocidade de pesquisa (%) */
  researchSpeedBonus?: number;
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
}

/**
 * Representa uma batalha ativa em andamento
 */
export interface ActiveBattle {
  /** ID único da batalha */
  id: string;
  /** ID da província onde ocorre a batalha */
  provinceId: string;
  /** ID do exército atacante */
  attackerArmyId: string;
  /** ID do exército defensor */
  defenderArmyId: string;
  /** Lista completa de IDs de todos os exércitos participantes (incluindo reforços) */
  participantArmyIds: string[];
  /** Duração total da batalha em dias */
  daysTotal: number;
  /** Dias restantes para o fim da batalha */
  daysRemaining: number;
  /** Tropas iniciais do atacante */
  attackerInitialTroops: number;
  /** Tropas iniciais do defensor */
  defenderInitialTroops: number;
  /** Tropas atuais do atacante */
  attackerCurrentTroops: number;
  /** Tropas atuais do defensor */
  defenderCurrentTroops: number;
  /** Baixas acumuladas do atacante */
  attackerCasualties: number;
  /** Baixas acumuladas do defensor */
  defenderCasualties: number;
  /** Data de início da batalha */
  startDate: GameDate;
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
