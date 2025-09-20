/**
 * Constantes das coleções Firebase do projeto
 * Centralizadas para evitar duplicação e facilitar manutenção
 */

// Coleções principais
export const FIREBASE_COLLECTIONS = {
  QUOTATIONS: "quotations",
  SHOPPING_LIST_ITEMS: "shopping_list_items", 
  FORNECEDORES: "fornecedores",
  SUPPLIES: "supplies",
  SUPPLY_CATEGORIES: "supply_categories",
  WHATSAPP_QUEUE: "whatsapp_queue",
  WHATSAPP_CONVERSATIONS: "whatsapp_conversations"
} as const;

// Tipos para TypeScript
export type FirebaseCollection = typeof FIREBASE_COLLECTIONS[keyof typeof FIREBASE_COLLECTIONS];

// Constantes de status
export const QUOTATION_STATUS = {
  OPEN: "open",
  CLOSED: "closed", 
  EXPIRED: "expired"
} as const;

export type QuotationStatus = typeof QUOTATION_STATUS[keyof typeof QUOTATION_STATUS];