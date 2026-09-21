/**
 * ============================================================
 * MÓDULO 1 - Componente Principal do Jogo
 * ============================================================
 * Ponto de entrada da aplicação. Gerencia o estado global do jogo
 * e orquestra a renderização de todos os módulos:
 * - TopBar (barra superior com dados do país)
 * - GameMap (mapa interativo com províncias)
 * - ProvincePanel (painel lateral de detalhes)
 * 
 * Este módulo está preparado para expansão nos próximos módulos
 * (economia, guerra, diplomacia, etc.)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { TopBar } from './components/TopBar';
import { GameMap } from './components/GameMap';
import { ProvincePanel } from './components/ProvincePanel';
import { provincesData, getProvincesByCountry } from './data/provinces';
import { countries, getCountryByTag } from './data/countries';
import { GameDate } from './types';

/**
 * Componente raiz da aplicação
 */
const App: React.FC = () => {
  // === Estado do Jogo ===

  /** Tag do país do jogador */
  const [playerCountryTag] = useState<string>('IMP');

  /** Data atual do jogo */
  const [date, setDate] = useState<GameDate>({
    year: 1444,
    month: 11,
    day: 11,
  });

  /** Velocidade do jogo (0 = pausado) */
  const [gameSpeed, setGameSpeed] = useState<number>(0);

  /** Província selecionada pelo jogador */
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);

  /** Província sob o cursor */
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  /** Painel lateral visível */
  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);

  // === Dados Derivados ===

  /** País do jogador */
  const playerCountry = useMemo(
    () => getCountryByTag(playerCountryTag)!,
    [playerCountryTag]
  );

  /** Província selecionada (dados completos) */
  const selectedProvinceData = useMemo(
    () => provincesData.find((p) => p.id === selectedProvince) ?? null,
    [selectedProvince]
  );

  // === Handlers ===

  /**
   * Handler de click em uma província no mapa
   */
  const handleProvinceClick = useCallback((provinceId: string) => {
    setSelectedProvince(provinceId);
    setIsPanelOpen(true);
  }, []);

  /**
   * Handler de hover em uma província
   */
  const handleProvinceHover = useCallback((provinceId: string | null) => {
    setHoveredProvince(provinceId);
  }, []);

  /**
   * Fecha o painel lateral
   */
  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedProvince(null);
  }, []);

  /**
   * Altera a velocidade do jogo
   */
  const handleSpeedChange = useCallback((speed: number) => {
    setGameSpeed(speed);
  }, []);

  // === Renderização ===

  return (
    <div className="game">
      {/* === Barra Superior === */}
      <TopBar
        playerCountry={playerCountry}
        date={date}
        gameSpeed={gameSpeed}
        onSpeedChange={handleSpeedChange}
      />

      {/* === Área Principal === */}
      <div className="game__main">
        {/* === Mapa === */}
        <GameMap
          provinces={provincesData}
          countries={countries}
          selectedProvince={selectedProvince}
          hoveredProvince={hoveredProvince}
          onProvinceHover={handleProvinceHover}
          onProvinceClick={handleProvinceClick}
        />

        {/* === Painel Lateral (condicional) === */}
        {isPanelOpen && selectedProvinceData && (
          <ProvincePanel
            province={selectedProvinceData}
            countries={countries}
            onClose={handleClosePanel}
            onProvinceClick={handleProvinceClick}
          />
        )}
      </div>

      {/* === Barra Inferior (Mini Info) === */}
      <div className="game__bottom-bar">
        <div className="game__bottom-info">
          <span className="game__bottom-label">Províncias Controladas:</span>
          <span className="game__bottom-value">
            {playerCountry.provinces.length}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">População Total:</span>
          <span className="game__bottom-value">
            {getProvincesByCountry(playerCountryTag)
              .reduce((sum, p) => sum + p.population, 0)
              .toLocaleString()}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Nações no Mapa:</span>
          <span className="game__bottom-value">{countries.length}</span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Módulo:</span>
          <span className="game__bottom-value game__bottom-value--highlight">
            1 - Base
          </span>
        </div>
      </div>
    </div>
  );
};

export default App;
