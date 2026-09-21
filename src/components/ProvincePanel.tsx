/**
 * ============================================================
 * MÓDULO 2 - Painel de Província (Side Panel) com Construções
 * ============================================================
 * Exibe detalhes da província selecionada:
 * - Nome, país dono, população
 * - Barra de crescimento populacional
 * - Seção de edifícios e construções
 * - Províncias vizinhas
 */

import React, { useState } from 'react';
import { Province, Country, BuildingType } from '../types';
import { getCountryByTag } from '../data/countries';
import {
  BUILDING_DEFINITIONS,
  getBuildingCost,
  getBuildingTime,
  canBuildBuilding,
} from '../data/buildings';

interface ProvincePanelProps {
  province: Province;
  countries: Country[];
  playerCountry: Country;
  onClose: () => void;
  onProvinceClick: (provinceId: string) => void;
  onBuild: (provinceId: string, buildingType: BuildingType) => void;
}

/**
 * Abas do painel
 */
type PanelTab = 'info' | 'buildings';

/**
 * Painel lateral com detalhes da província selecionada
 */
export const ProvincePanel: React.FC<ProvincePanelProps> = ({
  province,
  countries,
  playerCountry,
  onClose,
  onProvinceClick,
  onBuild,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('info');
  const ownerCountry = getCountryByTag(province.owner);
  const isPlayerOwned = province.owner === playerCountry.tag;

  /**
   * Obtém o nível atual de um tipo de edifício na província
   */
  const getBuildingLevel = (type: BuildingType): number => {
    const building = province.buildings.find((b) => b.type === type);
    return building?.level ?? 0;
  };

  /**
   * Verifica se há uma construção em andamento
   */
  const hasConstructionInProgress = province.buildings.some(
    (b) => b.daysRemaining > 0
  );

  /**
   * Busca os dados das províncias vizinhas
   */
  const neighborProvinces = province.neighbors.map((nId) => {
    const allProvinces = countries.flatMap((c) =>
      c.provinces.map((pId) => ({ id: pId, owner: c.tag }))
    );
    const neighborData = allProvinces.find((p) => p.id === nId);
    const neighborCountry = neighborData
      ? getCountryByTag(neighborData.owner)
      : undefined;
    return { id: nId, country: neighborCountry };
  });

  return (
    <div className="province-panel">
      {/* === Cabeçalho do Painel === */}
      <div className="province-panel__header">
        <h2 className="province-panel__title">{province.name}</h2>
        <button
          className="province-panel__close"
          onClick={onClose}
          title="Fechar"
        >
          ✕
        </button>
      </div>

      {/* === Abas === */}
      <div className="province-panel__tabs">
        <button
          className={`province-panel__tab ${
            activeTab === 'info' ? 'province-panel__tab--active' : ''
          }`}
          onClick={() => setActiveTab('info')}
        >
          📊 Informações
        </button>
        <button
          className={`province-panel__tab ${
            activeTab === 'buildings' ? 'province-panel__tab--active' : ''
          }`}
          onClick={() => setActiveTab('buildings')}
          disabled={!isPlayerOwned}
        >
          🏗️ Edifícios
        </button>
      </div>

      {/* === Conteúdo da Aba === */}
      <div className="province-panel__content">
        {activeTab === 'info' && (
          <>
            {/* Informações Básicas */}
            <div className="province-panel__section">
              <div className="province-panel__info-row">
                <span className="province-panel__label">ID:</span>
                <span className="province-panel__value">{province.id}</span>
              </div>
              <div className="province-panel__info-row">
                <span className="province-panel__label">País:</span>
                <span className="province-panel__value province-panel__value--country">
                  {ownerCountry?.flag} {ownerCountry?.name ?? 'Desconhecido'}
                </span>
              </div>
              <div className="province-panel__info-row">
                <span className="province-panel__label">Desenvolvimento:</span>
                <span className="province-panel__value">
                  {'⭐'.repeat(Math.min(province.development, 5))}
                  {province.development > 5 && `+${province.development - 5}`}
                </span>
              </div>
              <div className="province-panel__info-row">
                <span className="province-panel__label">Defesa:</span>
                <span className="province-panel__value">🛡️ {province.defense}</span>
              </div>
            </div>

            {/* População */}
            <div className="province-panel__section">
              <h3 className="province-panel__subtitle">População</h3>
              <div className="province-panel__info-row">
                <span className="province-panel__label">Habitantes:</span>
                <span className="province-panel__value">
                  {province.population.toLocaleString()} /{' '}
                  {province.maxPopulation.toLocaleString()}
                </span>
              </div>
              <div className="province-panel__pop-bar">
                <div
                  className="province-panel__pop-fill"
                  style={{
                    width: `${(province.population / province.maxPopulation) * 100}%`,
                    backgroundColor: ownerCountry?.color ?? '#666',
                  }}
                />
              </div>
              <span className="province-panel__pop-text">
                {((province.population / province.maxPopulation) * 100).toFixed(1)}%
                da capacidade
              </span>
            </div>

            {/* Edifícios Ativos (resumo) */}
            {province.buildings.length > 0 && (
              <div className="province-panel__section">
                <h3 className="province-panel__subtitle">Edifícios Ativos</h3>
                <div className="province-panel__buildings-summary">
                  {province.buildings
                    .filter((b) => b.daysRemaining <= 0)
                    .map((b) => {
                      const def = BUILDING_DEFINITIONS[b.type];
                      return (
                        <div key={b.type} className="province-panel__building-badge">
                          <span>{def.icon}</span>
                          <span className="province-panel__building-badge-level">
                            Nv.{b.level}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}

            {/* Províncias Vizinhas */}
            <div className="province-panel__section">
              <h3 className="province-panel__subtitle">
                Fronteiras ({province.neighbors.length})
              </h3>
              <div className="province-panel__neighbors">
                {neighborProvinces.map((neighbor) => (
                  <button
                    key={neighbor.id}
                    className="province-panel__neighbor-btn"
                    onClick={() => onProvinceClick(neighbor.id)}
                    style={{
                      borderLeftColor: neighbor.country?.color ?? '#666',
                    }}
                  >
                    <span className="province-panel__neighbor-flag">
                      {neighbor.country?.flag ?? '?'}
                    </span>
                    <span className="province-panel__neighbor-id">
                      {neighbor.id}
                    </span>
                    <span className="province-panel__neighbor-country">
                      {neighbor.country?.adjective ?? '???'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'buildings' && isPlayerOwned && (
          <>
            {/* Construção em Andamento */}
            {hasConstructionInProgress && (
              <div className="province-panel__section province-panel__section--highlight">
                <h3 className="province-panel__subtitle">🔨 Em Construção</h3>
                {province.buildings
                  .filter((b) => b.daysRemaining > 0)
                  .map((b) => {
                    const def = BUILDING_DEFINITIONS[b.type];
                    const totalTime = getBuildingTime(b.type, b.level - 1);
                    const progress =
                      ((totalTime - b.daysRemaining) / totalTime) * 100;
                    return (
                      <div key={b.type} className="province-panel__construction">
                        <div className="province-panel__construction-header">
                          <span>
                            {def.icon} {def.name} (Nv.{b.level})
                          </span>
                          <span className="province-panel__construction-days">
                            {b.daysRemaining} dias
                          </span>
                        </div>
                        <div className="province-panel__construction-bar">
                          <div
                            className="province-panel__construction-fill"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Opções de Construção */}
            <div className="province-panel__section">
              <h3 className="province-panel__subtitle">Construir Edifício</h3>
              <div className="province-panel__build-options">
                {(Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).map(
                  (type) => {
                    const def = BUILDING_DEFINITIONS[type];
                    const currentLevel = getBuildingLevel(type);
                    const canBuild = canBuildBuilding(type, currentLevel);
                    const cost = getBuildingCost(type, currentLevel);
                    const buildTime = getBuildingTime(type, currentLevel);
                    const canAfford = playerCountry.resources.gold >= cost;
                    const cantBuildReason = hasConstructionInProgress
                      ? 'Já há construção em andamento'
                      : !canBuild
                      ? 'Nível máximo atingido'
                      : !canAfford
                      ? 'Ouro insuficiente'
                      : null;

                    return (
                      <div
                        key={type}
                        className={`province-panel__build-option ${
                          !canBuild || !canAfford || hasConstructionInProgress
                            ? 'province-panel__build-option--disabled'
                            : ''
                        }`}
                      >
                        <div className="province-panel__build-option-header">
                          <span className="province-panel__build-icon">
                            {def.icon}
                          </span>
                          <div className="province-panel__build-info">
                            <span className="province-panel__build-name">
                              {def.name}
                              {currentLevel > 0 && (
                                <span className="province-panel__build-level">
                                  {' '}
                                  → Nv.{currentLevel + 1}
                                </span>
                              )}
                            </span>
                            <span className="province-panel__build-desc">
                              {def.description}
                            </span>
                          </div>
                        </div>

                        <div className="province-panel__build-costs">
                          <span className="province-panel__build-cost">
                            💰 {cost} ouro
                          </span>
                          <span className="province-panel__build-cost">
                            📅 {buildTime} dias
                          </span>
                        </div>

                        {/* Bônus */}
                        <div className="province-panel__build-bonuses">
                          {def.bonusPerLevel.goldIncome && (
                            <span className="province-panel__build-bonus">
                              +{(def.bonusPerLevel.goldIncome * (currentLevel + 1)).toFixed(1)}💰/dia
                            </span>
                          )}
                          {def.bonusPerLevel.manpowerGain && (
                            <span className="province-panel__build-bonus">
                              +{def.bonusPerLevel.manpowerGain * (currentLevel + 1)}👥/dia
                            </span>
                          )}
                          {def.bonusPerLevel.defense && (
                            <span className="province-panel__build-bonus">
                              +{def.bonusPerLevel.defense * (currentLevel + 1)}🛡️
                            </span>
                          )}
                          {def.bonusPerLevel.growthBonus && (
                            <span className="province-panel__build-bonus">
                              +{(def.bonusPerLevel.growthBonus * (currentLevel + 1)).toFixed(1)}%📈
                            </span>
                          )}
                        </div>

                        <button
                          className="province-panel__build-btn"
                          disabled={!!cantBuildReason}
                          onClick={() => onBuild(province.id, type)}
                          title={cantBuildReason ?? 'Construir'}
                        >
                          {cantBuildReason ?? '🔨 Construir'}
                        </button>
                      </div>
                    );
                  }
                )}
              </div>
            </div>
          </>
        )}

        {activeTab === 'buildings' && !isPlayerOwned && (
          <div className="province-panel__section">
            <p className="province-panel__no-access">
              ⚠️ Esta província não pertence ao seu país.
            </p>
          </div>
        )}
      </div>

      {/* === Rodapé === */}
      <div className="province-panel__footer">
        <div
          className="province-panel__color-swatch"
          style={{ backgroundColor: province.color }}
        />
        <span className="province-panel__footer-text">
          {province.id} | Pop: {province.population.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
