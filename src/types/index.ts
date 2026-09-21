/**
 * ============================================================
 * MÓDULO 1 - Tipos e Interfaces do Jogo de Grande Estratégia
 * ============================================================
 * Define as estruturas de dados fundamentais para províncias,
 * países e estado do jogo.
 */

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
  /** População fictícia da província */
  population: number;
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
  /** Bandeira (emoji ou ícone) */
  flag: string;
}

/**
 * Recursos globais de um país
 */
export interface CountryResources {
  /** Ouro/moeda do país */
  gold: number;
  /** Mão de obra disponível */
  manpower: number;
  /** Estabilidade política (0-100) */
  stability: number;
  /** Prestígio militar */
  prestige: number;
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
