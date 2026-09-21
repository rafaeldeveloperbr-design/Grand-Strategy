/**
 * ============================================================
 * MÓDULO 3 - Componente de Marcador de Exército
 * ============================================================
 * Renderiza exércitos no mapa como marcadores visuais.
 */

import React from 'react';
import { Army, Province, Country } from '../types';
import { calculateArmySize } from '../engine/combat';

interface ArmyMarkerProps {
  army: Army;
  provinces: Province[];
  countries: Country[];
  isSelected: boolean;
  onClick: (armyId: string) => void;
}

/**
 * Marcador visual de um exército no mapa
 */
export const ArmyMarker: React.FC<ArmyMarkerProps> = ({
  army,
  provinces,
  countries,
  isSelected,
  onClick,
}) => {
  const country = countries.find(c => c.tag === army.owner);
  const size = calculateArmySize(army);
  
  // Determina posição (se está em movimento, usa position; senão, centro da província)
  let x: number, y: number;
  
  if (army.position && army.destination) {
    // Em movimento - usa posição interpolada
    x = army.position.x;
    y = army.position.y;
  } else if (army.location) {
    // Parado - usa centro da província
    const province = provinces.find(p => p.id === army.location);
    if (!province) return null;
    x = province.center.x;
    y = province.center.y + 20; // Offset para não sobrepor nome da província
  } else {
    return null;
  }

  // Formata número de tropas (ex: 5000 -> 5k)
  const formatSize = (n: number): string => {
    if (n >= 10000) return `${(n / 1000).toFixed(0)}k`;
    if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
    return n.toString();
  };

  return (
    <g
      className={`army-marker ${isSelected ? 'army-marker--selected' : ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick(army.id);
      }}
      style={{ cursor: 'pointer' }}
    >
      {/* Sombra */}
      <ellipse
        cx={x}
        cy={y + 12}
        rx="14"
        ry="4"
        fill="rgba(0,0,0,0.3)"
      />
      
      {/* Base do marcador */}
      <rect
        x={x - 16}
        y={y - 8}
        width="32"
        height="20"
        rx="4"
        fill={country?.color ?? '#555'}
        stroke={isSelected ? '#FFD700' : '#000'}
        strokeWidth={isSelected ? 2 : 1}
        className="army-marker__body"
      />
      
      {/* Bandeira/Ícone */}
      <text
        x={x - 10}
        y={y + 5}
        fontSize="10"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {country?.flag ?? '⚔️'}
      </text>
      
      {/* Número de tropas */}
      <text
        x={x + 6}
        y={y + 4}
        fontSize="8"
        fontWeight="bold"
        fill="#FFF"
        textAnchor="middle"
        dominantBaseline="middle"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
      >
        {formatSize(size)}
      </text>
      
      {/* Indicador de movimento */}
      {army.destination && (
        <circle
          cx={x + 14}
          cy={y - 6}
          r="3"
          fill="#4CAF50"
          stroke="#FFF"
          strokeWidth="0.5"
        >
          <animate
            attributeName="opacity"
            values="1;0.3;1"
            dur="1s"
            repeatCount="indefinite"
          />
        </circle>
      )}
      
      {/* Indicador de seleção */}
      {isSelected && (
        <circle
          cx={x}
          cy={y + 2}
          r="20"
          fill="none"
          stroke="#FFD700"
          strokeWidth="1.5"
          strokeDasharray="3,2"
          opacity="0.8"
        >
          <animateTransform
            attributeName="transform"
            type="rotate"
            from={`0 ${x} ${y + 2}`}
            to={`360 ${x} ${y + 2}`}
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
      )}
    </g>
  );
};
