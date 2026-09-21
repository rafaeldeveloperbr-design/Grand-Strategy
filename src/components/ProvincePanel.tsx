/**
 * ============================================================
 * MÓDULO 1 - Painel de Província (Side Panel)
 * ============================================================
 * Exibe detalhes da província selecionada:
 * - Nome da província
 * - País dono
 * - População
 * - Lista de vizinhos
 * - Botão para fechar
 */

import React from 'react';
import { Province, Country } from '../types';
import { getCountryByTag } from '../data/countries';

interface ProvincePanelProps {
  province: Province;
  countries: Country[];
  onClose: () => void;
  onProvinceClick: (provinceId: string) => void;
}

/**
 * Painel lateral com detalhes da província selecionada
 */
export const ProvincePanel: React.FC<ProvincePanelProps> = ({
  province,
  countries,
  onClose,
  onProvinceClick,
}) => {
  const ownerCountry = getCountryByTag(province.owner);

  /**
   * Busca os dados das províncias vizinhas
   */
  const neighborProvinces = province.neighbors.map((nId) => {
    // Busca a província nos dados de todos os países
    const allProvinces = countries.flatMap((c) => c.provinces.map((pId) => ({ id: pId, owner: c.tag })));
    const neighborData = allProvinces.find((p) => p.id === nId);
    const neighborCountry = neighborData ? getCountryByTag(neighborData.owner) : undefined;
    return { id: nId, country: neighborCountry };
  });

  return (
    <div className="province-panel">
      {/* === Cabeçalho do Painel === */}
      <div className="province-panel__header">
        <h2 className="province-panel__title">{province.name}</h2>
        <button className="province-panel__close" onClick={onClose} title="Fechar">
          ✕
        </button>
      </div>

      {/* === Informações Básicas === */}
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
          <span className="province-panel__label">População:</span>
          <span className="province-panel__value">
            {province.population.toLocaleString()} habitantes
          </span>
        </div>
      </div>

      {/* === Barra de População Visual === */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">Demografia</h3>
        <div className="province-panel__pop-bar">
          <div
            className="province-panel__pop-fill"
            style={{
              width: `${Math.min((province.population / 50000) * 100, 100)}%`,
              backgroundColor: ownerCountry?.color ?? '#666',
            }}
          />
        </div>
        <span className="province-panel__pop-text">
          {((province.population / 50000) * 100).toFixed(0)}% da capacidade
        </span>
      </div>

      {/* === Províncias Vizinhas === */}
      <div className="province-panel__section">
        <h3 className="province-panel__subtitle">Fronteiras ({province.neighbors.length})</h3>
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
              <span className="province-panel__neighbor-id">{neighbor.id}</span>
              <span className="province-panel__neighbor-country">
                {neighbor.country?.adjective ?? '???'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* === Rodapé com cor da província === */}
      <div className="province-panel__footer">
        <div
          className="province-panel__color-swatch"
          style={{ backgroundColor: province.color }}
        />
        <span className="province-panel__footer-text">
          Cor: {province.color}
        </span>
      </div>
    </div>
  );
};
