/**
 * ============================================================
 * MÓDULO 1 - Componente do Mapa Interativo
 * ============================================================
 * Renderiza o mapa SVG com todas as províncias.
 * Suporta:
 * - Hover para destacar províncias
 * - Click para selecionar províncias
 * - Cores automáticas baseadas no país dono
 * - Tooltip com nome da província
 * - Zoom e pan básico
 */

import React, { useState, useCallback, useRef, useMemo } from 'react';
import { Province, Country, Army, Recruitment, BuildingConstruction, ActiveBattle } from '../types';
import { ArmyMarker } from './ArmyMarker';
import { calculateArmyOffset } from '../engine/military';
import { getBuildingName, getUnitName } from '../utils/translations';
import { BUILDING_DEFINITIONS } from '../data/buildings';
import { UNIT_DEFINITIONS } from '../data/units';

interface MapProps {
  provinces: Province[];
  countries: Country[];
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  activeBattles: ActiveBattle[];
  selectedProvince: string | null;
  hoveredProvince: string | null;
  selectedArmy: string | null;
  onProvinceHover: (provinceId: string | null) => void;
  onProvinceClick: (provinceId: string) => void;
  onArmyClick: (armyId: string) => void;
  onProvinceRightClick: (provinceId: string) => void;
}

/**
 * Mapa interativo do jogo com províncias SVG
 */
export const GameMap: React.FC<MapProps> = ({
  provinces,
  countries,
  armies,
  recruitments,
  buildingConstructions,
  activeBattles,
  selectedProvince,
  hoveredProvince,
  selectedArmy,
  onProvinceHover,
  onProvinceClick,
  onArmyClick,
  onProvinceRightClick,
}) => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; province: Province } | null>(null);
  const [viewBox, setViewBox] = useState({ x: -20, y: 20, w: 840, h: 640 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hoveredArmyId, setHoveredArmyId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  /**
   * Calcula offsets para exércitos agrupados na mesma província.
   * Retorna um mapa de armyId -> {offsetX, offsetY}
   */
  const armyOffsets = useMemo(() => {
    const offsets = new Map<string, { offsetX: number; offsetY: number }>();
    
    // Agrupa exércitos por província (apenas os que estão parados)
    const groups = new Map<string, Army[]>();
    for (const army of armies) {
      if (army.location && !army.destination) {
        const group = groups.get(army.location) ?? [];
        group.push(army);
        groups.set(army.location, group);
      }
    }
    
    // Calcula offset para cada grupo
    for (const [, group] of groups) {
      if (group.length <= 1) {
        // Um único exército, sem offset
        offsets.set(group[0].id, { offsetX: 0, offsetY: 0 });
      } else {
        // Múltiplos exércitos - disposição circular
        group.forEach((army, index) => {
          const { offsetX, offsetY } = calculateArmyOffset(index, group.length);
          offsets.set(army.id, { offsetX, offsetY });
        });
      }
    }
    
    return offsets;
  }, [armies]);

  /**
   * Ordena exércitos para renderização:
   * - Exércitos em movimento primeiro (fundo)
   * - Exércitos normais
   * - Exército hovered por cima
   * - Exército selecionado no topo absoluto
   */
  const sortedArmies = useMemo(() => {
    const sorted = [...armies];
    sorted.sort((a, b) => {
      // Movendo ficam atrás
      const aMoving = a.destination ? 0 : 1;
      const bMoving = b.destination ? 0 : 1;
      if (aMoving !== bMoving) return aMoving - bMoving;
      
      // Selected fica no topo
      const aSelected = a.id === selectedArmy ? 2 : 0;
      const bSelected = b.id === selectedArmy ? 2 : 0;
      if (aSelected !== bSelected) return aSelected - bSelected;
      
      // Hovered fica acima dos normais
      const aHovered = a.id === hoveredArmyId ? 1 : 0;
      const bHovered = b.id === hoveredArmyId ? 1 : 0;
      return aHovered - bHovered;
    });
    return sorted;
  }, [armies, selectedArmy, hoveredArmyId]);

  /**
   * Obtém a cor de uma província baseada no país dono
   */
  const getProvinceColor = useCallback(
    (province: Province): string => {
      const country = countries.find((c) => c.tag === province.owner);
      return country?.color ?? '#555555';
    },
    [countries]
  );

  /**
   * Obtém a cor clara de uma província (para hover)
   */
  const getProvinceLightColor = useCallback(
    (province: Province): string => {
      const country = countries.find((c) => c.tag === province.owner);
      return country?.colorLight ?? '#888888';
    },
    [countries]
  );

  /**
   * Determina a classe CSS de uma província baseada em seu estado
   */
  const getProvinceClass = (province: Province): string => {
    const classes = ['map__province'];
    if (province.id === selectedProvince) classes.push('map__province--selected');
    if (province.id === hoveredProvince) classes.push('map__province--hovered');
    return classes.join(' ');
  };

  /**
   * Handler de mouse enter na província
   */
  const handleMouseEnter = (e: React.MouseEvent, province: Province) => {
    onProvinceHover(province.id);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  };

  /**
   * Handler de mouse move (atualiza posição do tooltip)
   */
  const handleMouseMove = (e: React.MouseEvent, province: Province) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltip({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top - 40,
        province,
      });
    }
  };

  /**
   * Handler de mouse leave
   */
  const handleMouseLeave = () => {
    onProvinceHover(null);
    setTooltip(null);
  };

  /**
   * Handler de click na província
   */
  const handleClick = (provinceId: string) => {
    onProvinceClick(provinceId);
  };

  /**
   * Zoom in
   */
  const handleZoomIn = () => {
    setViewBox((prev) => ({
      x: prev.x + prev.w * 0.1,
      y: prev.y + prev.h * 0.1,
      w: prev.w * 0.8,
      h: prev.h * 0.8,
    }));
  };

  /**
   * Zoom out
   */
  const handleZoomOut = () => {
    setViewBox((prev) => ({
      x: prev.x - prev.w * 0.125,
      y: prev.y - prev.h * 0.125,
      w: prev.w * 1.25,
      h: prev.h * 1.25,
    }));
  };

  /**
   * Reset zoom
   */
  const handleResetZoom = () => {
    setViewBox({ x: -20, y: 20, w: 840, h: 640 });
  };

  /**
   * Pan handlers
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMovePan = (e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panStart.x) * (viewBox.w / 800);
      const dy = (e.clientY - panStart.y) * (viewBox.h / 600);
      setViewBox((prev) => ({
        ...prev,
        x: prev.x - dx,
        y: prev.y - dy,
      }));
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  /**
   * Obtém dados do país dono da província no tooltip
   */
  const getTooltipCountry = (province: Province) => {
    return countries.find((c) => c.tag === province.owner);
  };

  /**
   * Verifica se há atividades em uma província
   */
  const getProvinceActivities = (provinceId: string, provinceOwner: string) => {
    // Filtro de segurança: apenas mostra construções do dono atual
    const constructions = buildingConstructions.filter(
      c => c.provinceId === provinceId && c.owner === provinceOwner
    );
    const recruitmentsHere = recruitments.filter(
      r => r.provinceId === provinceId && r.owner === provinceOwner
    );
    
    return {
      hasConstructions: constructions.length > 0,
      hasRecruitments: recruitmentsHere.length > 0,
      constructions,
      recruitments: recruitmentsHere
    };
  };

  return (
    <div className="map-container">
      {/* === Controles de Zoom === */}
      <div className="map__zoom-controls">
        <button className="map__zoom-btn" onClick={handleZoomIn} title="Zoom In">
          🔍+
        </button>
        <button className="map__zoom-btn" onClick={handleZoomOut} title="Zoom Out">
          🔍−
        </button>
        <button className="map__zoom-btn" onClick={handleResetZoom} title="Reset">
          ⟲
        </button>
      </div>

      {/* === Instruções === */}
      <div className="map__instructions">
        <span>🖱️ Clique: selecionar | 🖱️ Direito: mover exército | Shift+Arrastar: mover mapa</span>
      </div>

      {/* === SVG do Mapa === */}
      <svg
        ref={svgRef}
        className="map__svg"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMovePan}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onContextMenu={(e) => {
          e.preventDefault();
          
          // Estratégia 1: Tenta encontrar via closest('[data-province-id]')
          const target = e.target as SVGElement;
          const provinceElement = target.closest?.('[data-province-id]');
          if (provinceElement) {
            const provinceId = provinceElement.getAttribute('data-province-id');
            if (provinceId) {
              onProvinceRightClick(provinceId);
              return;
            }
          }
          
          // Estratégia 2 (fallback): Mapeia coordenadas SVG para província
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const svgX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
            const svgY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
            const clickedProvince = provinces.find(p => {
              const dx = p.center.x - svgX;
              const dy = p.center.y - svgY;
              return Math.sqrt(dx * dx + dy * dy) < 60;
            });
            if (clickedProvince) {
              onProvinceRightClick(clickedProvince.id);
            }
          }
        }}
      >
        {/* Fundo do mar */}
        <rect x="-100" y="-100" width="1000" height="800" fill="#1a3a5c" />

        {/* Grid decorativo */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#1e4060" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect x="-100" y="-100" width="1000" height="800" fill="url(#grid)" />

        {/* === Províncias === */}
        {provinces.map((province) => {
          const isHovered = province.id === hoveredProvince;
          const isSelected = province.id === selectedProvince;
          const fillColor = isHovered || isSelected
            ? getProvinceLightColor(province)
            : getProvinceColor(province);

          return (
            <g key={province.id}>
              {/* Sombra da província */}
              <path
                d={province.path}
                fill="rgba(0,0,0,0.3)"
                transform="translate(2, 2)"
              />
              {/* Província principal */}
              <path
                d={province.path}
                fill={fillColor}
                stroke={isSelected ? '#FFD700' : isHovered ? '#FFFFFF' : '#2a2a2a'}
                strokeWidth={isSelected ? 3 : isHovered ? 2 : 1}
                className={getProvinceClass(province)}
                data-province-id={province.id}
                onMouseEnter={(e) => handleMouseEnter(e, province)}
                onMouseMove={(e) => handleMouseMove(e, province)}
                onMouseLeave={handleMouseLeave}
                onClick={() => handleClick(province.id)}
                style={{
                  cursor: 'pointer',
                  transition: 'fill 0.2s ease, stroke-width 0.15s ease',
                }}
              />
              {/* Nome da província (visível em zoom adequado) */}
              <text
                x={province.center.x}
                y={province.center.y}
                textAnchor="middle"
                dominantBaseline="middle"
                className="map__province-label"
                fill="rgba(255,255,255,0.8)"
                fontSize="8"
                fontWeight="bold"
                pointerEvents="none"
              >
                {province.name}
              </text>
              
              {/* Indicadores de atividades */}
              {(() => {
                const activities = getProvinceActivities(province.id, province.owner);
                const hasActivities = activities.hasConstructions || activities.hasRecruitments;
                
                if (!hasActivities) return null;
                
                const iconY = province.center.y - 12;
                let iconX = province.center.x - 8;
                
                return (
                  <g key={`activities-${province.id}`} pointerEvents="none">
                    {/* Ícone de construção */}
                    {activities.hasConstructions && (
                      <g>
                        <circle
                          cx={iconX}
                          cy={iconY}
                          r="6"
                          fill="rgba(255, 215, 0, 0.9)"
                          stroke="rgba(0, 0, 0, 0.5)"
                          strokeWidth="0.5"
                        />
                        <text
                          x={iconX}
                          y={iconY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="7"
                          pointerEvents="none"
                        >
                          🔨
                        </text>
                        <title>
                          {activities.constructions.map(c => {
                            const def = BUILDING_DEFINITIONS[c.buildingType];
                            return `${def.name}: ${c.daysRemaining}d`;
                          }).join('\n')}
                        </title>
                      </g>
                    )}
                    
                    {/* Ícone de recrutamento */}
                    {activities.hasRecruitments && (
                      <g>
                        <circle
                          cx={iconX + 16}
                          cy={iconY}
                          r="6"
                          fill="rgba(231, 76, 60, 0.9)"
                          stroke="rgba(0, 0, 0, 0.5)"
                          strokeWidth="0.5"
                        />
                        <text
                          x={iconX + 16}
                          y={iconY}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize="7"
                          pointerEvents="none"
                        >
                          ⚔️
                        </text>
                        <title>
                          {activities.recruitments.map(r => {
                            const def = UNIT_DEFINITIONS[r.unitType];
                            return `${r.count > 1 ? `${r.count}x ` : ''}${def.name}: ${r.daysRemaining}d`;
                          }).join('\n')}
                        </title>
                      </g>
                    )}
                  </g>
                );
              })()}
              
              {/* Indicador de agitação provincial (unrest) */}
              {(() => {
                const unrest = province.unrest ?? 0;
                if (unrest <= 0) return null; // Não mostra se está pacífico
                
                const iconY = province.center.y + 15;
                const iconX = province.center.x;
                
                // Cor baseada no nível de unrest
                const getColor = (unrest: number) => {
                  if (unrest >= 80) return '#e74c3c'; // Vermelho - Crítico
                  if (unrest >= 60) return '#e67e22'; // Laranja - Alto
                  if (unrest >= 40) return '#f39c12'; // Amarelo - Moderado
                  if (unrest >= 20) return '#95a5a6'; // Cinza - Baixo
                  return '#2ecc71'; // Verde - Pacífico
                };
                
                const getDescription = (unrest: number) => {
                  if (unrest >= 80) return 'Crítico';
                  if (unrest >= 60) return 'Alto';
                  if (unrest >= 40) return 'Moderado';
                  if (unrest >= 20) return 'Baixo';
                  return 'Pacífico';
                };
                
                return (
                  <g key={`unrest-${province.id}`} pointerEvents="none">
                    <circle
                      cx={iconX}
                      cy={iconY}
                      r="5"
                      fill={getColor(unrest)}
                      stroke="rgba(0, 0, 0, 0.5)"
                      strokeWidth="0.5"
                      opacity="0.8"
                    />
                    <text
                      x={iconX}
                      y={iconY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize="6"
                      fill="white"
                      fontWeight="bold"
                      pointerEvents="none"
                    >
                      {Math.round(unrest)}
                    </text>
                    <title>
                      {`Agitação: ${getDescription(unrest)} (${Math.round(unrest)}%)\n`}
                      {unrest >= 80 ? '⚠️ Revolta iminente!' : ''}
                    </title>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* === Marcadores de capitais === */}
        {provinces
          .filter((p) => p.id === 'p1' || p.id === 'p6' || p.id === 'p10' || p.id === 'p14' || p.id === 'p17' || p.id === 'p20')
          .map((province) => (
            <g key={`cap-${province.id}`}>
              <circle
                cx={province.center.x}
                cy={province.center.y - 15}
                r="4"
                fill="#FFD700"
                stroke="#000"
                strokeWidth="1"
                pointerEvents="none"
              />
              <text
                x={province.center.x}
                y={province.center.y - 15}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize="5"
                fill="#000"
                pointerEvents="none"
              >
                ★
              </text>
            </g>
          ))}

        {/* === Linhas de movimento dos exércitos (path completo) === */}
        {armies
          .filter(a => a.destination && a.location)
          .map((army) => {
            const country = countries.find(c => c.tag === army.owner);
            
            // Monta o path completo: location -> destination -> path[]
            const fullPath = [army.location!, army.destination!, ...army.path];
            const pathPoints = fullPath
              .map(pid => provinces.find(p => p.id === pid))
              .filter((p): p is Province => p !== undefined);

            if (pathPoints.length < 2) return null;

            // Cria a string do polyline
            const pointsStr = pathPoints
              .map(p => `${p.center.x},${p.center.y}`)
              .join(' ');

            return (
              <polyline
                key={`route-${army.id}`}
                points={pointsStr}
                fill="none"
                stroke={country?.colorLight ?? '#FFF'}
                strokeWidth="2"
                strokeDasharray="6,3"
                opacity="0.7"
                pointerEvents="none"
              >
                <animate
                  attributeName="stroke-dashoffset"
                  from="0"
                  to="-18"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </polyline>
            );
          })}

        {/* === Indicadores de Batalhas Ativas === */}
        {activeBattles.map((battle) => {
          const province = provinces.find(p => p.id === battle.provinceId);
          if (!province) return null;

          const attacker = armies.find(a => a.id === battle.attackerArmyId);
          const defender = armies.find(a => a.id === battle.defenderArmyId);
          if (!attacker || !defender) return null;

          const attackerCountry = countries.find(c => c.tag === attacker.owner);
          const defenderCountry = countries.find(c => c.tag === defender.owner);

          const progress = ((battle.daysTotal - battle.daysRemaining) / battle.daysTotal) * 100;

          return (
            <g key={`battle-${battle.id}`} pointerEvents="none">
              {/* Círculo de batalha pulsante */}
              <circle
                cx={province.center.x}
                cy={province.center.y}
                r="25"
                fill="none"
                stroke="#ff4444"
                strokeWidth="3"
                opacity="0.8"
              >
                <animate
                  attributeName="r"
                  values="20;28;20"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.8;0.4;0.8"
                  dur="1.5s"
                  repeatCount="indefinite"
                />
              </circle>

              {/* Ícone de espadas cruzadas */}
              <text
                x={province.center.x}
                y={province.center.y - 30}
                textAnchor="middle"
                fontSize="16"
                pointerEvents="none"
              >
                ⚔️
              </text>

              {/* Barra de progresso da batalha */}
              <rect
                x={province.center.x - 20}
                y={province.center.y + 20}
                width="40"
                height="6"
                fill="rgba(0, 0, 0, 0.5)"
                rx="3"
              />
              <rect
                x={province.center.x - 20}
                y={province.center.y + 20}
                width={40 * (progress / 100)}
                height="6"
                fill="#ff4444"
                rx="3"
              />

              {/* Texto com dias restantes */}
              <text
                x={province.center.x}
                y={province.center.y + 35}
                textAnchor="middle"
                fontSize="10"
                fontWeight="bold"
                fill="#fff"
                stroke="#000"
                strokeWidth="0.5"
              >
                {battle.daysRemaining}d
              </text>

              {/* Tooltip com informações da batalha */}
              <title>
                {`Batalha em ${province.name}\n`}
                {`${attackerCountry?.flag} ${attackerCountry?.name}: ${battle.attackerCurrentTroops} tropas\n`}
                {`${defenderCountry?.flag} ${defenderCountry?.name}: ${battle.defenderCurrentTroops} tropas\n`}
                {`Dias restantes: ${battle.daysRemaining}/${battle.daysTotal}\n`}
                {`Baixas: ${battle.attackerCasualties} vs ${battle.defenderCasualties}`}
              </title>
            </g>
          );
        })}

        {/* === Filtro de Glow para exércitos elevados === */}
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* === Marcadores de Exércitos (ordenados por z-index) === */}
        {sortedArmies.map((army) => {
          const offset = armyOffsets.get(army.id) ?? { offsetX: 0, offsetY: 0 };
          return (
            <ArmyMarker
              key={army.id}
              army={army}
              provinces={provinces}
              countries={countries}
              isSelected={army.id === selectedArmy}
              isHovered={army.id === hoveredArmyId}
              offsetX={offset.offsetX}
              offsetY={offset.offsetY}
              onClick={onArmyClick}
              onHover={setHoveredArmyId}
            />
          );
        })}
      </svg>

      {/* === Tooltip === */}
      {tooltip && (
        <div
          className="map__tooltip"
          style={{
            left: tooltip.x,
            top: tooltip.y,
          }}
        >
          <div className="map__tooltip-name">{tooltip.province.name}</div>
          <div className="map__tooltip-country">
            <span
              className="map__tooltip-color"
              style={{ backgroundColor: getProvinceColor(tooltip.province) }}
            />
            {getTooltipCountry(tooltip.province)?.name ?? 'Desconhecido'}
          </div>
          <div className="map__tooltip-pop">
            👥 {tooltip.province.population.toLocaleString()}
          </div>
        </div>
      )}
    </div>
  );
};
