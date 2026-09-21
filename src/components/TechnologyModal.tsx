/**
 * ============================================================
 * MÓDULO 6 - Modal de Tecnologias e Focos Nacionais
 * ============================================================
 */

import React, { useState } from 'react';
import { Country } from '../types';
import { CountryTechState } from '../types/technology';
import { NATIONAL_FOCUSES, TECHNOLOGIES } from '../data/technologies';

interface TechnologyModalProps {
  playerCountry: Country;
  techState: CountryTechState;
  onStartFocus: (focusId: string) => void;
  onStartResearch: (techId: string) => void;
  onClose: () => void;
}

type TabType = 'focuses' | 'technologies';

/**
 * Modal de Tecnologias e Focos Nacionais
 */
export const TechnologyModal: React.FC<TechnologyModalProps> = ({
  playerCountry,
  techState,
  onStartFocus,
  onStartResearch,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('focuses');

  const canStartFocus = (focusId: string): boolean => {
    // Validação de segurança
    if (!focusId || !techState) return false;
    
    const focus = NATIONAL_FOCUSES?.find(f => f?.id === focusId);
    if (!focus || focus.completed) return false;
    if (techState.activeFocusId === focusId) return false;
    
    // Verifica pré-requisitos
    if (focus.prerequisites) {
      return focus.prerequisites.every(prereqId => 
        techState.completedFocuses?.includes(prereqId)
      );
    }
    return true;
  };

  const canStartResearch = (techId: string): boolean => {
    // Validação de segurança
    if (!techId || !techState || !playerCountry) return false;
    
    const tech = TECHNOLOGIES?.find(t => t?.id === techId);
    if (!tech || tech.researched) return false;
    if (techState.activeResearchId === techId) return false;
    
    // Verifica pré-requisitos
    const hasPrereqs = tech.prerequisites?.every(prereqId => 
      techState.completedTechnologies?.includes(prereqId)
    ) ?? true;
    if (!hasPrereqs) return false;
    
    // Verifica se tem ouro suficiente
    return playerCountry.resources?.gold >= tech.costGold;
  };

  const getPrerequisiteNames = (prereqIds: string[], type: 'focus' | 'tech'): string[] => {
    if (!prereqIds) return [];
    
    if (type === 'focus') {
      return prereqIds.map(id => {
        const focus = NATIONAL_FOCUSES?.find(f => f?.id === id);
        return focus?.title ?? id;
      });
    } else {
      return prereqIds.map(id => {
        const tech = TECHNOLOGIES?.find(t => t?.id === id);
        return tech?.title ?? id;
      });
    }
  };

  const renderFocuses = () => {
    return (
      <div className="tech-modal__content">
        <h3>Focos Nacionais</h3>
        <div className="tech-modal__grid">
          {NATIONAL_FOCUSES?.map(focus => {
            if (!focus) return null;
            
            const isActive = techState?.activeFocusId === focus.id;
            const isCompleted = techState?.completedFocuses?.includes(focus.id) ?? false;
            const canStart = canStartFocus(focus.id);
            const progress = focus.durationDays > 0 ? (focus.currentProgressDays / focus.durationDays) * 100 : 0;

            return (
              <div
                key={focus.id}
                className={`tech-modal__card ${isCompleted ? 'completed' : ''} ${isActive ? 'active' : ''}`}
              >
                <div className="tech-modal__card-header">
                  <span className="tech-modal__icon">{focus.icon}</span>
                  <h4>{focus.title}</h4>
                </div>
                <p className="tech-modal__description">{focus.description}</p>
                
                {focus.prerequisites && focus.prerequisites.length > 0 && (
                  <div className="tech-modal__prerequisites">
                    <strong>Pré-requisitos:</strong>
                    <ul>
                      {getPrerequisiteNames(focus.prerequisites, 'focus').map((name, idx) => (
                        <li key={idx}>{name}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="tech-modal__reward">
                  <strong>Recompensa:</strong>
                  <span>
                    {focus.rewardEffect.type === 'COMBAT_POWER' && 
                      `+${(focus.rewardEffect.value * 100).toFixed(0)}% poder de ${focus.rewardEffect.unitType}`}
                    {focus.rewardEffect.type === 'GOLD_INCOME' && 
                      `+${(focus.rewardEffect.value * 100).toFixed(0)}% renda de ouro`}
                    {focus.rewardEffect.type === 'BUILD_COST' && 
                      `${(focus.rewardEffect.value * 100).toFixed(0)}% custo de construção`}
                    {focus.rewardEffect.type === 'BUILD_TIME' && 
                      `${(focus.rewardEffect.value * 100).toFixed(0)}% tempo de construção`}
                    {focus.rewardEffect.type === 'MANPOWER' && 
                      `+${(focus.rewardEffect.value * 100).toFixed(0)}% mão de obra`}
                  </span>
                </div>

                {!isCompleted && (
                  <div className="tech-modal__progress">
                    <div className="tech-modal__progress-bar">
                      <div 
                        className="tech-modal__progress-fill"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="tech-modal__progress-text">
                      {focus.currentProgressDays} / {focus.durationDays} dias
                    </span>
                  </div>
                )}

                <div className="tech-modal__actions">
                  {isCompleted ? (
                    <span className="tech-modal__status completed">✓ Concluído</span>
                  ) : isActive ? (
                    <span className="tech-modal__status active">⏳ Em progresso</span>
                  ) : (
                    <button
                      className="tech-modal__button"
                      disabled={!canStart}
                      onClick={() => onStartFocus(focus.id)}
                    >
                      Iniciar Foco
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderTechnologies = () => {
    const categories = ['MILITARY', 'ECONOMY', 'INFRASTRUCTURE'] as const;
    const categoryNames = {
      MILITARY: 'Militar',
      ECONOMY: 'Econômico',
      INFRASTRUCTURE: 'Infraestrutura'
    };

    return (
      <div className="tech-modal__content">
        <h3>Pesquisas Tecnológicas</h3>
        <div className="tech-modal__categories">
          {categories.map(category => (
            <div key={category} className="tech-modal__category">
              <h4>{categoryNames[category]}</h4>
              <div className="tech-modal__grid">
                {TECHNOLOGIES?.filter(t => t?.category === category).map(tech => {
                  if (!tech) return null;
                  
                  const isActive = techState?.activeResearchId === tech.id;
                  const isResearched = techState?.completedTechnologies?.includes(tech.id) ?? false;
                  const canStart = canStartResearch(tech.id);
                  const progress = tech.durationDays > 0 ? (tech.currentProgressDays / tech.durationDays) * 100 : 0;

                  return (
                    <div
                      key={tech.id}
                      className={`tech-modal__card ${isResearched ? 'completed' : ''} ${isActive ? 'active' : ''}`}
                    >
                      <div className="tech-modal__card-header">
                        <span className="tech-modal__icon">{tech.icon}</span>
                        <h4>{tech.title}</h4>
                      </div>
                      <p className="tech-modal__description">{tech.description}</p>
                      
                      {tech.prerequisites.length > 0 && (
                        <div className="tech-modal__prerequisites">
                          <strong>Pré-requisitos:</strong>
                          <ul>
                            {getPrerequisiteNames(tech.prerequisites, 'tech').map((name, idx) => (
                              <li key={idx}>{name}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="tech-modal__cost">
                        <strong>Custo:</strong>
                        <span>💰 {tech.costGold} ouro</span>
                      </div>

                      <div className="tech-modal__reward">
                        <strong>Recompensa:</strong>
                        <span>
                          {tech.rewardEffect.type === 'COMBAT_POWER' && 
                            `+${(tech.rewardEffect.value * 100).toFixed(0)}% poder de ${tech.rewardEffect.unitType}`}
                          {tech.rewardEffect.type === 'GOLD_INCOME' && 
                            `+${(tech.rewardEffect.value * 100).toFixed(0)}% renda de ouro`}
                          {tech.rewardEffect.type === 'BUILD_COST' && 
                            `${(tech.rewardEffect.value * 100).toFixed(0)}% custo de construção`}
                          {tech.rewardEffect.type === 'BUILD_TIME' && 
                            `${(tech.rewardEffect.value * 100).toFixed(0)}% tempo de construção`}
                          {tech.rewardEffect.type === 'MANPOWER' && 
                            `+${(tech.rewardEffect.value * 100).toFixed(0)}% mão de obra`}
                        </span>
                      </div>

                      {!isResearched && (
                        <div className="tech-modal__progress">
                          <div className="tech-modal__progress-bar">
                            <div 
                              className="tech-modal__progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="tech-modal__progress-text">
                            {tech.currentProgressDays} / {tech.durationDays} dias
                          </span>
                        </div>
                      )}

                      <div className="tech-modal__actions">
                        {isResearched ? (
                          <span className="tech-modal__status completed">✓ Pesquisado</span>
                        ) : isActive ? (
                          <span className="tech-modal__status active">⏳ Pesquisando</span>
                        ) : (
                          <button
                            className="tech-modal__button"
                            disabled={!canStart}
                            onClick={() => onStartResearch(tech.id)}
                          >
                            Iniciar Pesquisa
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="tech-modal">
      <div className="tech-modal__overlay" onClick={onClose} />
      <div className="tech-modal__container">
        <div className="tech-modal__header">
          <h2>Tecnologias e Focos Nacionais</h2>
          <button className="tech-modal__close" onClick={onClose}>×</button>
        </div>

        <div className="tech-modal__tabs">
          <button
            className={`tech-modal__tab ${activeTab === 'focuses' ? 'active' : ''}`}
            onClick={() => setActiveTab('focuses')}
          >
            Focos Nacionais
          </button>
          <button
            className={`tech-modal__tab ${activeTab === 'technologies' ? 'active' : ''}`}
            onClick={() => setActiveTab('technologies')}
          >
            Pesquisas Tecnológicas
          </button>
        </div>

        {activeTab === 'focuses' && renderFocuses()}
        {activeTab === 'technologies' && renderTechnologies()}
      </div>
    </div>
  );
};
