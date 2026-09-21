/**
 * ============================================================
 * MÓDULO 2 - Componente Principal do Jogo
 * ============================================================
 * Ponto de entrada da aplicação. Gerencia o estado global do jogo
 * e orquestra a renderização de todos os módulos:
 * - TopBar (barra superior com dados do país e economia)
 * - GameMap (mapa interativo com províncias)
 * - ProvincePanel (painel lateral com construções)
 * 
 * Inclui o game loop (tick system) que processa:
 * - Economia (renda/despesas)
 * - Crescimento populacional
 * - Construção de edifícios
 */

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { TopBar } from './components/TopBar';
import { GameMap } from './components/GameMap';
import { ProvincePanel } from './components/ProvincePanel';
import { provincesData, getProvincesByCountry } from './data/provinces';
import { countries as initialCountries, getCountryByTag } from './data/countries';
import { processDailyTick } from './engine/economy';
import { BuildingType, Country, Province, GameDate } from './types';
import { getBuildingCost, getBuildingTime } from './data/buildings';

/**
 * Velocidades do jogo em ms por tick (dia)
 * Velocidade 1 = 1 dia por segundo
 * Velocidade 5 = 5 dias por segundo
 */
const SPEED_INTERVALS: Record<number, number> = {
  0: 0,     // Pausado
  1: 1000,  // 1 dia/segundo
  2: 500,   // 2 dias/segundo
  3: 250,   // 4 dias/segundo
  4: 125,   // 8 dias/segundo
  5: 60,    // ~16 dias/segundo
};

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

  /** Dados dinâmicos das províncias (mutáveis pelo game loop) */
  const [provinces, setProvinces] = useState<Province[]>(() =>
    provincesData.map((p) => ({ ...p, buildings: [...p.buildings] }))
  );

  /** Dados dinâmicos dos países (mutáveis pelo game loop) */
  const [allCountries, setAllCountries] = useState<Country[]>(() =>
    initialCountries.map((c) => ({
      ...c,
      resources: { ...c.resources },
      economy: { ...c.economy },
    }))
  );

  /** Ref para o intervalo do game loop */
  const gameLoopRef = useRef<number | null>(null);
  /** Ref para dados atuais (evita stale closure) */
  const provincesRef = useRef(provinces);
  const countriesRef = useRef(allCountries);

  // Mantém refs atualizadas
  useEffect(() => {
    provincesRef.current = provinces;
  }, [provinces]);

  useEffect(() => {
    countriesRef.current = allCountries;
  }, [allCountries]);

  // === Dados Derivados ===

  /** País do jogador (atualizado dinamicamente) */
  const playerCountry = useMemo(
    () => allCountries.find((c) => c.tag === playerCountryTag)!,
    [allCountries, playerCountryTag]
  );

  /** Província selecionada (dados atualizados) */
  const selectedProvinceData = useMemo(
    () => provinces.find((p) => p.id === selectedProvince) ?? null,
    [provinces, selectedProvince]
  );

  // === Game Loop ===

  /**
   * Avança a data em 1 dia
   */
  const advanceDate = useCallback((currentDate: GameDate): GameDate => {
    let { day, month, year } = currentDate;
    day++;

    if (day > 30) {
      day = 1;
      month++;
    }
    if (month > 12) {
      month = 1;
      year++;
    }

    return { day, month, year };
  }, []);

  /**
   * Processa um tick do jogo (1 dia)
   * Usa refs para evitar stale closures
   */
  const processTick = useCallback(() => {
    const currentProvinces = provincesRef.current;
    const currentCountries = countriesRef.current;

    // Avança a data
    setDate((prevDate) => advanceDate(prevDate));

    // Processa cada país
    const updatedCountries = currentCountries.map((country) => {
      const countryProvinces = currentProvinces.filter(
        (p) => p.owner === country.tag
      );
      const { country: updatedCountry, provinces: updatedProvs } =
        processDailyTick(country, countryProvinces);

      // Atualiza províncias deste país
      setProvinces((prevProvs) => {
        const newProvs = [...prevProvs];
        for (const updatedProv of updatedProvs) {
          const idx = newProvs.findIndex((p) => p.id === updatedProv.id);
          if (idx !== -1) {
            newProvs[idx] = updatedProv;
          }
        }
        return newProvs;
      });

      return updatedCountry;
    });

    setAllCountries(updatedCountries);
  }, [advanceDate]);

  /**
   * Gerencia o game loop baseado na velocidade
   */
  useEffect(() => {
    // Limpa intervalo anterior
    if (gameLoopRef.current) {
      clearInterval(gameLoopRef.current);
      gameLoopRef.current = null;
    }

    // Se não está pausado, inicia o loop
    if (gameSpeed > 0) {
      const interval = SPEED_INTERVALS[gameSpeed];
      gameLoopRef.current = window.setInterval(processTick, interval);
    }

    return () => {
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, [gameSpeed, processTick]);

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

  /**
   * Constrói um edifício em uma província
   */
  const handleBuild = useCallback(
    (provinceId: string, buildingType: BuildingType) => {
      const province = provinces.find((p) => p.id === provinceId);
      if (!province || province.owner !== playerCountryTag) return;

      // Verifica se já há construção em andamento
      if (province.buildings.some((b) => b.daysRemaining > 0)) return;

      // Obtém nível atual
      const existingBuilding = province.buildings.find(
        (b) => b.type === buildingType
      );
      const currentLevel = existingBuilding?.level ?? 0;

      // Calcula custo e tempo
      const cost = getBuildingCost(buildingType, currentLevel);
      const buildTime = getBuildingTime(buildingType, currentLevel);

      // Verifica se pode pagar
      if (playerCountry.resources.gold < cost) return;

      // Deduz o custo
      setAllCountries((prev) =>
        prev.map((c) =>
          c.tag === playerCountryTag
            ? {
                ...c,
                resources: {
                  ...c.resources,
                  gold: c.resources.gold - cost,
                },
              }
            : c
        )
      );

      // Adiciona/atualiza o edifício na província
      setProvinces((prev) =>
        prev.map((p) => {
          if (p.id !== provinceId) return p;

          const newBuildings = [...p.buildings];
          const existingIdx = newBuildings.findIndex(
            (b) => b.type === buildingType
          );

          if (existingIdx >= 0) {
            // Upgrade
            newBuildings[existingIdx] = {
              ...newBuildings[existingIdx],
              level: newBuildings[existingIdx].level + 1,
              daysRemaining: buildTime,
            };
          } else {
            // Novo edifício
            newBuildings.push({
              type: buildingType,
              level: 1,
              daysRemaining: buildTime,
            });
          }

          return { ...p, buildings: newBuildings };
        })
      );
    },
    [provinces, playerCountryTag, playerCountry.resources.gold]
  );

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
          provinces={provinces}
          countries={allCountries}
          selectedProvince={selectedProvince}
          hoveredProvince={hoveredProvince}
          onProvinceHover={handleProvinceHover}
          onProvinceClick={handleProvinceClick}
        />

        {/* === Painel Lateral (condicional) === */}
        {isPanelOpen && selectedProvinceData && (
          <ProvincePanel
            province={selectedProvinceData}
            countries={allCountries}
            playerCountry={playerCountry}
            onClose={handleClosePanel}
            onProvinceClick={handleProvinceClick}
            onBuild={handleBuild}
          />
        )}
      </div>

      {/* === Barra Inferior (Mini Info) === */}
      <div className="game__bottom-bar">
        <div className="game__bottom-info">
          <span className="game__bottom-label">Províncias:</span>
          <span className="game__bottom-value">
            {playerCountry.provinces.length}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Pop. Total:</span>
          <span className="game__bottom-value">
            {provinces
              .filter((p) => p.owner === playerCountryTag)
              .reduce((sum, p) => sum + p.population, 0)
              .toLocaleString()}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Renda Líquida:</span>
          <span
            className={`game__bottom-value ${
              playerCountry.economy.goldIncome - playerCountry.economy.goldExpense >= 0
                ? 'game__bottom-value--positive'
                : 'game__bottom-value--negative'
            }`}
          >
            {(playerCountry.economy.goldIncome - playerCountry.economy.goldExpense).toFixed(1)}/dia
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Velocidade:</span>
          <span className="game__bottom-value game__bottom-value--highlight">
            {gameSpeed === 0 ? '⏸ Pausado' : `▶ x${gameSpeed}`}
          </span>
        </div>
        <div className="game__bottom-info">
          <span className="game__bottom-label">Módulo:</span>
          <span className="game__bottom-value game__bottom-value--highlight">
            2 - Economia
          </span>
        </div>
      </div>
    </div>
  );
};

export default App;
