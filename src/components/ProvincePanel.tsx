/**
 * ============================================================
 * MÓDULO 3 - Painel de Província com Sistema Militar
 * ============================================================
 * Exibe detalhes da província selecionada:
 * - Nome, país dono, população
 * - Seção de edifícios e construções
 * - Seção Militar: exércitos presentes e recrutamento
 * - Províncias vizinhas
 */

import React, { useState } from 'react';
import { Province, Country, BuildingType, Army, Recruitment, UnitType, BuildingConstruction } from '../types';
import { getCountryByTag } from '../data/countries';
import {
  BUILDING_DEFINITIONS,
  getBuildingCost,
  getBuildingTime,
  canBuildBuilding,
} from '../data/buildings';
import { UNIT_DEFINITIONS } from '../data/units';
import { calculateArmySize } from '../engine/combat';
import { isActiveConstruction } from '../engine/buildings';
import { getBuildingName, getUnitName } from '../utils/translations';

interface ProvincePanelProps {
  province: Province;
  countries: Country[];
  playerCountry: Country;
  armies: Army[];
  recruitments: Recruitment[];
  buildingConstructions: BuildingConstruction[];
  onClose: () => void;
  onProvinceClick: (provinceId: string) => void;
  onBuild: (provinceId: string, buildingType: BuildingType) => void;
  onRecruit: (provinceId: string, unitType: UnitType) => void;
  onCancelRecruitment: (recruitmentId: string) => void;
  onCancelBuilding: (constructionId: string) => void;
}

type PanelTab = 'info' | 'buildings' | 'military';

/**
 * Painel lateral com detalhes da província
 */
export const ProvincePanel: React.FC<ProvincePanelProps> = ({
  province,
  countries,
  playerCountry,
  armies,
  recruitments,
  buildingConstructions,
  onClose,
  onProvinceClick,
  onBuild,
  onRecruit,
  onCancelRecruitment,
  onCancelBuilding,
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>('info');
  const ownerCountry = getCountryByTag(province.owner);
  const isPlayerOwned = province.owner === playerCountry.tag;

  // Exércitos nesta província
  const armiesHere = armies.filter(a => a.location === province.id);
  // Recrutamentos nesta província
  const recruitmentsHere = recruitments.filter(r => r.provinceId === province.id);

  const getBuildingLevel = (type: BuildingType): number => {
    const building = province.buildings.find((b) => b.type === type);
    return building?.level ?? 0;
  };

  const neighborProvinces = province.neighbors.map((nId) => {
    const allProvinces = countries.flatMap((c) =>
      c.provinces.map((pId) => ({ id: pId, owner: c.tag }))
    );
    const neighborData = allProvinces.find((p) => p.id === nId);
    const neighborCountry = neighborData ? getCountryByTag(neighborData.owner) : undefined;
    return { id: nId, country: neighborCountry };
  });

  // Filtra atividades em andamento para o painel lateral
  const provinceConstructions = buildingConstructions.filter(c => c.provinceId === province.id);
  const hasActivities = provinceConstructions.length > 0 || recruitmentsHere.length > 0;

  return (
    <div className="province-panel">
      {/* === Cabeçalho === */}
      <div className="province-panel__header">
        <h2 className="province-panel__title">{province.name}</h2>
        <button className="province-panel__close" onClick={onClose}>✕</button>
      </div>

      {/* === Layout de Duas Colunas === */}
      <div className="province-panel__layout">
        {/* === Coluna Principal (Esquerda) === */}
        <div className="province-panel__main">
          {/* === Abas === */}
          <div className="province-panel__tabs">
            <button
              className={`province-panel__tab ${activeTab === 'info' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('info')}
            >
              📊 Info
            </button>
            <button
              className={`province-panel__tab ${activeTab === 'buildings' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('buildings')}
              disabled={!isPlayerOwned}
            >
              🏗️ Obras
            </button>
            <button
              className={`province-panel__tab ${activeTab === 'military' ? 'province-panel__tab--active' : ''}`}
              onClick={() => setActiveTab('military')}
              disabled={!isPlayerOwned}
            >
              ⚔️ Militar
            </button>
          </div>

          {/* === Conteúdo === */}
          <div className="province-panel__content">
            {/* === ABA INFO === */}
            {activeTab === 'info' && (
              <>
                <div className="province-panel__section">
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
                    </span>
                  </div>
                  <div className="province-panel__info-row">
                    <span className="province-panel__label">Defesa:</span>
                    <span className="province-panel__value">🛡️ {province.defense}</span>
                  </div>
                </div>

                <div className="province-panel__section">
                  <h3 className="province-panel__subtitle">População</h3>
                  <div className="province-panel__info-row">
                    <span className="province-panel__label">Habitantes:</span>
                    <span className="province-panel__value">
                      {province.population.toLocaleString()} / {province.maxPopulation.toLocaleString()}
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
                </div>

                {/* Exércitos presentes (resumo) */}
                {armiesHere.length > 0 && (
                  <div className="province-panel__section">
                    <h3 className="province-panel__subtitle">Tropas Presentes</h3>
                    {armiesHere.map(army => {
                      const armyCountry = getCountryByTag(army.owner);
                      return (
                        <div key={army.id} className="province-panel__army-summary">
                          <span>{armyCountry?.flag} {army.name}</span>
                          <span className="province-panel__army-size">
                            {calculateArmySize(army).toLocaleString()} 👥
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Fronteiras */}
                <div className="province-panel__section">
                  <h3 className="province-panel__subtitle">Fronteiras ({province.neighbors.length})</h3>
                  <div className="province-panel__neighbors">
                    {neighborProvinces.map((neighbor) => (
                      <button
                        key={neighbor.id}
                        className="province-panel__neighbor-btn"
                        onClick={() => onProvinceClick(neighbor.id)}
                        style={{ borderLeftColor: neighbor.country?.color ?? '#666' }}
                      >
                        <span>{neighbor.country?.flag ?? '?'}</span>
                        <span className="province-panel__neighbor-id">{neighbor.id}</span>
                        <span className="province-panel__neighbor-country">
                          {neighbor.country?.adjective ?? '???'}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* === ABA EDIFÍCIOS === */}
            {activeTab === 'buildings' && isPlayerOwned && (
              <>
                <div className="province-panel__section">
                  <h3 className="province-panel__subtitle">Construir</h3>
                  <div className="province-panel__build-options">
                    {(Object.keys(BUILDING_DEFINITIONS) as BuildingType[]).map((type) => {
                      const def = BUILDING_DEFINITIONS[type];
                      const currentLevel = getBuildingLevel(type);
                      const canBuild = canBuildBuilding(type, currentLevel);
                      const cost = getBuildingCost(type, currentLevel);
                      const buildTime = getBuildingTime(type, currentLevel);
                      const canAfford = playerCountry.resources.gold >= cost;
                      const cantBuildReason = !canBuild
                        ? 'Nível máximo'
                        : !canAfford
                        ? 'Ouro insuficiente'
                        : null;

                      return (
                        <div
                          key={type}
                          className={`province-panel__build-option ${!canBuild || !canAfford ? 'province-panel__build-option--disabled' : ''}`}
                        >
                          <div className="province-panel__build-option-header">
                            <span className="province-panel__build-icon">{def.icon}</span>
                            <div className="province-panel__build-info">
                              <span className="province-panel__build-name">
                                {def.name}
                                {currentLevel > 0 && <span className="province-panel__build-level"> → Nv.{currentLevel + 1}</span>}
                              </span>
                              <span className="province-panel__build-desc">
                                {def.description}
                              </span>
                            </div>
                          </div>
                          <div className="province-panel__build-costs">
                            <span className="province-panel__build-cost">💰 {cost}</span>
                            <span className="province-panel__build-cost">📅 {buildTime}d</span>
                          </div>
                          <button
                            className="province-panel__build-btn"
                            disabled={!!cantBuildReason}
                            onClick={() => onBuild(province.id, type)}
                          >
                            {cantBuildReason ?? '🔨 Construir'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* === ABA MILITAR === */}
            {activeTab === 'military' && isPlayerOwned && (
              <>
                {/* Exércitos presentes */}
                <div className="province-panel__section">
                  <h3 className="province-panel__subtitle">Exércitos na Província</h3>
                  {armiesHere.length === 0 ? (
                    <p className="province-panel__no-armies">Nenhum exército presente</p>
                  ) : (
                    armiesHere.map(army => {
                      const armyCountry = getCountryByTag(army.owner);
                      return (
                        <div key={army.id} className="province-panel__army-card">
                          <div className="province-panel__army-card-header">
                            <span>{armyCountry?.flag} {army.name}</span>
                            <span className="province-panel__army-card-size">
                              {calculateArmySize(army).toLocaleString()} 👥
                            </span>
                          </div>
                          <div className="province-panel__army-card-regiments">
                            {army.regiments.map((reg, i) => (
                              <span key={i} className="province-panel__regiment-badge">
                                {reg.type === 'infantry' ? '🗡️' : reg.type === 'cavalry' ? '🐎' : '💣'}
                                {Math.floor(reg.strength)}
                              </span>
                            ))}
                          </div>
                          {army.destination && (
                            <div className="province-panel__army-card-moving">
                              🚶 Marchando... ({Math.round(army.movementProgress * 100)}%)
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Recrutar novas unidades */}
                <div className="province-panel__section">
                  <h3 className="province-panel__subtitle">Recrutar Unidades</h3>
                  <div className="province-panel__build-options">
                    {(Object.keys(UNIT_DEFINITIONS) as UnitType[]).map((type) => {
                      const def = UNIT_DEFINITIONS[type];
                      const canAffordGold = playerCountry.resources.gold >= def.cost;
                      const canAffordManpower = playerCountry.resources.manpower >= def.manpowerCost;
                      const canRecruit = canAffordGold && canAffordManpower;
                      const cantRecruitReason = !canAffordGold
                        ? 'Ouro insuficiente'
                        : !canAffordManpower
                        ? 'Manpower insuficiente'
                        : null;

                      return (
                        <div
                          key={type}
                          className={`province-panel__build-option ${!canRecruit ? 'province-panel__build-option--disabled' : ''}`}
                        >
                          <div className="province-panel__build-option-header">
                            <span className="province-panel__build-icon">{def.icon}</span>
                            <div className="province-panel__build-info">
                              <span className="province-panel__build-name">{def.name}</span>
                              <span className="province-panel__build-desc">
                                ATK:{def.attack} DEF:{def.defense} MOB:{def.mobility}
                              </span>
                            </div>
                          </div>
                          <div className="province-panel__build-costs">
                            <span className="province-panel__build-cost">💰 {def.cost}</span>
                            <span className="province-panel__build-cost">👥 {def.manpowerCost}</span>
                            <span className="province-panel__build-cost">📅 {def.trainingTime}d</span>
                          </div>
                          <button
                            className="province-panel__build-btn"
                            disabled={!canRecruit}
                            onClick={() => onRecruit(province.id, type)}
                          >
                            {cantRecruitReason ?? '🗡️ Recrutar'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {(activeTab === 'buildings' || activeTab === 'military') && !isPlayerOwned && (
              <div className="province-panel__section">
                <p className="province-panel__no-access">⚠️ Esta província não pertence ao seu país.</p>
              </div>
            )}
          </div>
        </div>

        {/* === Coluna Lateral (Direita) - Atividades em Andamento === */}
        {isPlayerOwned && (
          <div className="province-panel__sidebar">
            <div className="province-panel__sidebar-content">
              <h3 className="province-panel__sidebar-title">📋 Atividades</h3>
              
              {!hasActivities && (
                <p className="province-panel__sidebar-empty">
                  Nenhuma obra ou recrutamento em andamento.
                </p>
              )}

              {/* Construções em Andamento */}
              {provinceConstructions.length > 0 && (
                <div className="province-panel__sidebar-section">
                  <h4 className="province-panel__sidebar-subtitle">🔨 Construções</h4>
                  {provinceConstructions.map((item, idx) => {
                    const def = BUILDING_DEFINITIONS[item.buildingType];
                    const progress = ((item.totalDays - item.daysRemaining) / item.totalDays) * 100;
                    const isActive = idx === 0;
                    
                    return (
                      <div key={item.id} className="province-panel__sidebar-item">
                        <div className="province-panel__sidebar-item-header">
                          <span>
                            {def.icon} {def.name}
                            {!isActive && <small style={{ marginLeft: '4px', opacity: 0.7 }}>(Fila)</small>}
                          </span>
                          <button
                            className="province-panel__construction-cancel"
                            onClick={() => onCancelBuilding(item.id)}
                            title={isActive ? "Cancelar (Reembolso proporcional)" : "Cancelar (Reembolso 100%)"}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="province-panel__sidebar-item-info">
                          <span className="province-panel__construction-days">
                            {isActive ? `${item.daysRemaining}d` : `${item.totalDays}d`}
                          </span>
                        </div>
                        <div className="province-panel__construction-bar">
                          <div 
                            className="province-panel__construction-fill" 
                            style={{ 
                              width: isActive ? `${progress}%` : '0%',
                              backgroundColor: isActive ? undefined : '#666'
                            }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recrutamentos em Andamento */}
              {recruitmentsHere.length > 0 && (
                <div className="province-panel__sidebar-section">
                  <h4 className="province-panel__sidebar-subtitle">⚔️ Recrutando</h4>
                  {recruitmentsHere.map(rec => {
                    const def = UNIT_DEFINITIONS[rec.unitType];
                    const totalTime = def.trainingTime;
                    const progress = ((totalTime - rec.daysRemaining) / totalTime) * 100;
                    return (
                      <div key={rec.id} className="province-panel__sidebar-item">
                        <div className="province-panel__sidebar-item-header">
                          <span>{def.icon} {rec.count > 1 ? `${rec.count}x ` : ''}{def.name}</span>
                          <button
                            className="province-panel__construction-cancel"
                            onClick={() => onCancelRecruitment(rec.id)}
                            title="Cancelar recrutamento"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="province-panel__sidebar-item-info">
                          <span className="province-panel__construction-days">{rec.daysRemaining}d</span>
                        </div>
                        <div className="province-panel__construction-bar">
                          <div className="province-panel__construction-fill" style={{ width: `${progress}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* === Rodapé === */}
      <div className="province-panel__footer">
        <div className="province-panel__color-swatch" style={{ backgroundColor: province.color }} />
        <span className="province-panel__footer-text">
          {province.id} | Pop: {province.population.toLocaleString()}
        </span>
      </div>
    </div>
  );
};
