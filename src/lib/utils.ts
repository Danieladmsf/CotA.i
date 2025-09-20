import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formata valor numérico como moeda brasileira (BRL)
 * @param value - Valor a ser formatado
 * @param includeSymbol - Se deve incluir o símbolo R$ (padrão: true)
 * @returns String formatada como moeda
 */
export function formatCurrency(value: number | null | undefined, includeSymbol = true): string {
  if (value === null || value === undefined || isNaN(value)) return "-";
  
  const formatted = value.toLocaleString("pt-BR", { 
    style: includeSymbol ? "currency" : "decimal",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  
  return formatted;
}

/**
 * Valida se uma URL de imagem é válida
 * @param url - URL a ser validada
 * @returns true se a URL é válida, false caso contrário
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string' || url.trim() === '') return false;
  
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
  } catch {
    return false;
  }
}
