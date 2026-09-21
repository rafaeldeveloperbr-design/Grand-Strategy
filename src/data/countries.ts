/**
 * ============================================================
 * MÓDULO 1 - Definição dos Países
 * ============================================================
 * Contém os dados iniciais de todas as nações no mapa.
 * Cada país possui uma tag única, cor, e lista de províncias.
 */

import { Country } from '../types';

export const countries: Country[] = [
  {
    tag: 'IMP',
    name: 'Império Aureliano',
    adjective: 'Aureliana',
    color: '#8B0000',
    colorLight: '#C41E3A',
    provinces: ['p1', 'p2', 'p3', 'p4', 'p5'],
    resources: { gold: 5000, manpower: 120000, stability: 75, prestige: 80 },
    flag: '🦅',
  },
  {
    tag: 'REP',
    name: 'República de Valória',
    adjective: 'Valoriana',
    color: '#1E3A8B',
    colorLight: '#3B82F6',
    provinces: ['p6', 'p7', 'p8', 'p9'],
    resources: { gold: 3500, manpower: 85000, stability: 82, prestige: 60 },
    flag: '⚔️',
  },
  {
    tag: 'RNO',
    name: 'Reino de Nordheim',
    adjective: 'Nordiana',
    color: '#1B5E20',
    colorLight: '#4CAF50',
    provinces: ['p10', 'p11', 'p12', 'p13'],
    resources: { gold: 2800, manpower: 65000, stability: 90, prestige: 45 },
    flag: '🛡️',
  },
  {
    tag: 'KHA',
    name: 'Khanato de Steppe',
    adjective: 'Steppeana',
    color: '#F57F17',
    colorLight: '#FFC107',
    provinces: ['p14', 'p15', 'p16'],
    resources: { gold: 2000, manpower: 95000, stability: 55, prestige: 50 },
    flag: '🐎',
  },
  {
    tag: 'THC',
    name: 'Teocracia de Solara',
    adjective: 'Solariana',
    color: '#6A1B9A',
    colorLight: '#AB47BC',
    provinces: ['p17', 'p18', 'p19'],
    resources: { gold: 4200, manpower: 55000, stability: 88, prestige: 70 },
    flag: '☀️',
  },
  {
    tag: 'LIG',
    name: 'Liga Mercantil de Portus',
    adjective: 'Portusiana',
    color: '#00695C',
    colorLight: '#26A69A',
    provinces: ['p20', 'p21', 'p22'],
    resources: { gold: 8000, manpower: 40000, stability: 70, prestige: 55 },
    flag: '⚓',
  },
];

/**
 * Obtém um país pela sua tag
 */
export function getCountryByTag(tag: string): Country | undefined {
  return countries.find((c) => c.tag === tag);
}

/**
 * Obtém a cor de um país pela tag
 */
export function getCountryColor(tag: string): string {
  const country = getCountryByTag(tag);
  return country?.color ?? '#555555';
}
