/**
 * ============================================================
 * DICIONÁRIOS DE TRADUÇÃO
 * ============================================================
 * Mapeia IDs técnicos para nomes legíveis em português
 */

export const BUILDING_NAMES: Record<string, string> = {
  farm: 'Fazenda',
  market: 'Mercado',
  barracks: 'Acampamento',
  fortification: 'Fortificação',
};

export const UNIT_NAMES: Record<string, string> = {
  infantry: 'Infantaria',
  cavalry: 'Cavalaria',
  artillery: 'Artilharia',
};

export function getBuildingName(type: string): string {
  return BUILDING_NAMES[type.toLowerCase()] || type;
}

export function getUnitName(type: string): string {
  return UNIT_NAMES[type.toLowerCase()] || type;
}
