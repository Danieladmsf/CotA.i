/**
 * Unit Formatters
 *
 * Utilitários para formatação de unidades de medida.
 */

import type { UnitOfMeasure } from '@/types';

/**
 * Abrevia unidades de medida para exibição compacta
 *
 * @param unit - Unidade de medida completa
 * @returns Abreviação da unidade
 *
 * @example
 * abbreviateUnit("Kilograma(s)") // "Kg"
 * abbreviateUnit("Litro(s)") // "Lt"
 */
export function abbreviateUnit(unit: UnitOfMeasure | string): string {
  const abbreviations: Record<string, string> = {
    "Kilograma(s)": "Kg",
    "Litro(s)": "Lt",
    "Unidade(s)": "Unid.",
    "Grama(s)": "g",
    "Mililitro(s)": "ml",
    "Caixa(s)": "Cx.",
    "Pacote(s)": "Pct.",
    "Dúzia(s)": "Dz.",
    "Peça(s)": "Pç.",
    "Metro(s)": "m",
    "Lata(s)": "Lata",
    "Garrafa(s)": "Gf.",
  };

  // Se tem abreviação mapeada, retorna
  if (abbreviations[unit]) {
    return abbreviations[unit];
  }

  // Fallback: extrai parte antes do parênteses
  if (typeof unit === 'string' && unit.includes("(")) {
    return unit.substring(0, unit.indexOf("(")).trim();
  }

  return String(unit);
}

/**
 * Obtém o nome completo de uma unidade de medida
 *
 * @param unit - Unidade (pode ser abreviada ou completa)
 * @returns Nome completo da unidade
 */
export function getFullUnitName(unit: string): string {
  const fullNames: Record<string, string> = {
    "Kg": "Kilograma(s)",
    "Lt": "Litro(s)",
    "Unid.": "Unidade(s)",
    "g": "Grama(s)",
    "ml": "Mililitro(s)",
    "Cx.": "Caixa(s)",
    "Pct.": "Pacote(s)",
    "Dz.": "Dúzia(s)",
    "Pç.": "Peça(s)",
    "m": "Metro(s)",
    "Lata": "Lata(s)",
    "Gf.": "Garrafa(s)",
  };

  return fullNames[unit] || unit;
}
