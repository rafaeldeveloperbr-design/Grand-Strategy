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

import React, { useState, useCallback, useRef } from 'react';
import { Province, Country, Army } from '../types';
import { ArmyMarker } from './ArmyMarker';

interface MapProps {
  provinces: Province[];
  countries: Country[];
  armies: Army[];
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
  const svgRef = useRef<SVGSVGElement>(null);

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
          // Encontra a província sob o cursor
          const rect = svgRef.current?.getBoundingClientRect();
          if (rect) {
            const svgX = ((e.clientX - rect.left) / rect.width) * viewBox.w + viewBox.x;
            const svgY = ((e.clientY - rect.top) / rect.height) * viewBox.h + viewBox.y;
            const clickedProvince = provinces.find(p => {
              // Simplificado - usa distância ao centro
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

        {/* === Linhas de movimento dos exércitos === */}
        {armies
          .filter(a => a.destination && a.location)
          .map((army) => {
            const origin = provinces.find(p => p.id === army.location);
            const dest = provinces.find(p => p.id === army.destination);
            if (!origin || !dest) return null;
            const country = countries.find(c => c.tag === army.owner);
            return (
              <line
                key={`route-${army.id}`}
                x1={origin.center.x}
                y1={origin.center.y}
                x2={dest.center.x}
                y2={dest.center.y}
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
              </line>
            );
          })}

        {/* === Marcadores de Exércitos === */}
        {armies.map((army) => (
          <ArmyMarker
            key={army.id}
            army={army}
            provinces={provinces}
            countries={countries}
            isSelected={army.id === selectedArmy}
            onClick={onArmyClick}
          />
        ))}
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
