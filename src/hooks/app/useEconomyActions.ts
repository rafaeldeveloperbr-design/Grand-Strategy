/**
 * useEconomyActions.ts - CORRIGIDO V2 - preserva ...c.resources igual App.tsx original
 * Fix: Cannot read properties of undefined (reading 'toLocaleString') no TopBar
 */
import { useCallback } from 'react';
import { queueBuilding, cancelBuilding } from '../../engine/buildings';
import { generateRecruitmentId, cancelRecruitment } from '../../engine/military';
import { getRecruitmentCost } from '../../data/units';
import { getBuildingCost, getBuildingTime } from '../../data/buildings';
import { LAWS } from '../../constants/laws';
import type { BuildingType, UnitType, Recruitment } from '../../types';

export function useEconomyActions(params: any) {
  const { provinces, playerCountry, playerCountryTag, buildingConstructions, setBuildingConstructions, setAllCountries, setRecruitments, addLog, addToast, formatGameDate, dateRef } = params;

  const handleBuild = useCallback((provinceId: string, buildingType: BuildingType) => {
    const province = provinces.find((p: any) => p.id === provinceId);
    if (!province || province.owner !== playerCountryTag) return;
    const existingBuilding = province.buildings.find((b: any) => b.type === buildingType);
    const currentLevel = existingBuilding?.level ?? 0;
    const cost = getBuildingCost(buildingType, currentLevel);
    const buildTime = getBuildingTime(buildingType, currentLevel);
    const result = queueBuilding(provinceId, playerCountryTag, buildingType, buildTime, cost, buildingConstructions, playerCountry.resources.gold);
    if (result.success) {
      setBuildingConstructions(result.updatedConstructions);
      setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.newGold } } : c));
    } else {
      addToast(`Ouro insuficiente para construir ${buildingType}`, 'error', 'Erro');
    }
  }, [provinces, playerCountryTag, playerCountry.resources.gold, buildingConstructions, addToast, setAllCountries, setBuildingConstructions]);

  const handleCancelBuilding = useCallback((constructionId: string) => {
    const result = cancelBuilding(constructionId, buildingConstructions, playerCountry.resources.gold);
    setBuildingConstructions(result.updatedConstructions);
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.newGold } } : c));
    if (result.refundedGold > 0) {
      addToast(`Construção cancelada. +${result.refundedGold} Ouro reembolsado!`, 'success', 'Reembolso', formatGameDate(dateRef.current));
    }
  }, [buildingConstructions, playerCountry.resources.gold, playerCountryTag, addToast, formatGameDate, dateRef, setAllCountries, setBuildingConstructions]);

  const handleRecruit = useCallback((provinceId: string, unitType: UnitType) => {
    const province = provinces.find((p: any) => p.id === provinceId);
    if (!province || province.owner !== playerCountryTag) return;
    const costs = getRecruitmentCost(unitType);
    const conscriptionLaw = (LAWS as any)[playerCountry.activeLaws?.conscription || 'conscription_peacetime'];
    const armyCostMultiplier = conscriptionLaw?.bonuses.armyCostMultiplier ?? 1.0;
    const adjustedGoldCost = Math.floor(costs.gold * armyCostMultiplier);
    if (playerCountry.resources.gold < adjustedGoldCost || playerCountry.resources.manpower < costs.manpower) {
      addLog(`❌ Recursos insuficientes para recrutar ${unitType}`);
      return;
    }
    // CORREÇÃO: usar ...c.resources igual original App.tsx linha 600
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: c.resources.gold - adjustedGoldCost, manpower: c.resources.manpower - costs.manpower } } : c));
    setRecruitments((prev: any) => {
      const existing = prev.find((r: any) => r.owner === playerCountryTag && r.provinceId === provinceId && r.unitType === unitType && r.daysRemaining === costs.days);
      if (existing) return prev.map((r: any) => r.id === existing.id ? { ...r, count: r.count + 1 } : r);
      const newRecruitment: Recruitment = { id: generateRecruitmentId(), provinceId, owner: playerCountryTag, unitType, daysRemaining: costs.days, count: 1 };
      return [...prev, newRecruitment];
    });
  }, [provinces, playerCountryTag, playerCountry, addLog, setAllCountries, setRecruitments]);

  const handleCancelRecruitment = useCallback((recruitmentId: string) => {
    const rec = params.recruitments.find((r: any) => r.id === recruitmentId);
    if (!rec) return;
    const result = cancelRecruitment(recruitmentId, params.recruitments, playerCountry.resources.gold);
    setRecruitments(result.updatedRecruitments);
    setAllCountries((prev: any) => prev.map((c: any) => c.tag === playerCountryTag ? { ...c, resources: { ...c.resources, gold: result.newGold } } : c));
    if (result.refundedGold > 0) addToast(`Recrutamento cancelado. +${result.refundedGold} Ouro reembolsado!`, 'success', 'Reembolso', formatGameDate(dateRef.current));
  }, [params.recruitments, playerCountry, playerCountryTag, addToast, formatGameDate, dateRef, setAllCountries, setRecruitments]);

  return { handleBuild, handleCancelBuilding, handleRecruit, handleCancelRecruitment };
}
