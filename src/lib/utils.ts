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

/**
 * Formata CNPJ com máscara XX.XXX.XXX/XXXX-XX
 * @param cnpj - CNPJ sem formatação (apenas números)
 * @returns CNPJ formatado ou "N/A" se inválido
 */
export function formatCNPJ(cnpj: string | null | undefined): string {
  if (!cnpj || typeof cnpj !== 'string') return "N/A";
  
  // Remove tudo que não for número
  const numbers = cnpj.replace(/\D/g, '');
  
  // Verifica se tem 14 dígitos
  if (numbers.length !== 14) return cnpj || "N/A";
  
  // Aplica a máscara XX.XXX.XXX/XXXX-XX
  return numbers.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
}

/**
 * Formata número de telefone/WhatsApp brasileiro
 * @param phone - Número sem formatação (apenas números)
 * @returns Número formatado ou "N/A" se inválido
 */
export function formatPhoneNumber(phone: string | null | undefined): string {
  if (!phone || typeof phone !== 'string') return "N/A";
  
  // Remove tudo que não for número
  const numbers = phone.replace(/\D/g, '');
  
  // Verifica diferentes formatos de números brasileiros
  if (numbers.length === 10) {
    // Formato: (XX) XXXX-XXXX (fixo sem 9)
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  } else if (numbers.length === 11) {
    // Formato: (XX) 9XXXX-XXXX (celular com 9)
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  } else if (numbers.length === 12 && numbers.startsWith('55')) {
    // Formato: 55XX XXXX-XXXX (país + fixo)
    return numbers.replace(/55(\d{2})(\d{4})(\d{4})/, '+55 ($1) $2-$3');
  } else if (numbers.length === 13 && numbers.startsWith('55')) {
    // Formato: 55XX 9XXXX-XXXX (país + celular)
    return numbers.replace(/55(\d{2})(\d{5})(\d{4})/, '+55 ($1) $2-$3');
  }
  
  // Se não for um formato padrão brasileiro, retorna o número original ou N/A
  return phone || "N/A";
}
