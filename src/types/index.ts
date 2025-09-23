
import type { Timestamp, FieldValue } from 'firebase/firestore';
import { z } from 'zod';

export const unitsOfMeasure = [
  "Unidade(s)", "Kilograma(s)", "Grama(s)", "Litro(s)", "Mililitro(s)",
  "Caixa(s)", "Pacote(s)", "Lata(s)", "Garrafa(s)", "Dúzia(s)", "Peça(s)", "Metro(s)"
] as const;

export type UnitOfMeasure = typeof unitsOfMeasure[number];

export interface SupplyCategory {
  id: string;
  name: string;
  name_lowercase?: string; // For case-insensitive queries
  userId: string; // To scope categories to a user
  createdAt?: Timestamp | FieldValue;
}

export interface Supply {
  id: string;
  name: string;
  name_lowercase?: string; // For case-insensitive searching
  unit: UnitOfMeasure;
  categoryId: string;
  categoryName: string;
  userId: string; // To scope supplies to a user
  preferredBrands?: string;
  notes?: string;
  quantityInStock?: number;
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface ShoppingListItem {
  id: string; // Document ID in shopping_list_items collection
  listId?: string; // Unique ID for the shopping list instance
  supplyId: string; // Reference to the id in the 'supplies' collection
  name: string; // Denormalized from Supply for display
  quantity: number;
  unit: UnitOfMeasure; // Denormalized from Supply or overridden
  preferredBrands?: string; // Denormalized from Supply or specific to this list item
  notes?: string;
  status: 'Pendente' | 'Cotado' | 'Comprado' | 'Recebido' | 'Cancelado' | 'Encerrado';
  listDate: Timestamp; // The main date of the shopping list this item belongs to
  deliveryDate: Timestamp; // The specific delivery date for this list item
  hasSpecificDate?: boolean; // True if the user explicitly set a date for this item
  quotationId?: string | null; // Links this item to a specific quotation
  userId: string; // To scope list items to a user
  categoryId?: string; // Denormalized from Supply
  categoryName?: string; // Denormalized from Supply
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface Fornecedor {
  id: string; // Firestore document ID
  empresa: string;
  cnpj: string;
  vendedor: string;
  whatsapp: string;
  fotoUrl: string;
  fotoHint: string;
  status?: 'ativo' | 'pendente';
  diasDeEntrega?: string[]; // Ex: ['segunda', 'quarta', 'sexta']
  userId: string; // To scope suppliers to a user
  createdAt?: Timestamp | FieldValue;
  updatedAt?: Timestamp | FieldValue;
}

export interface Quotation {
  id: string; // ID do documento no Firestore
  shoppingListDate: Timestamp; // Data da lista de compras original
  listId: string; // ID da lista de compras
  supplierIds: string[]; // IDs dos fornecedores convidados
  deadline: Timestamp; // Prazo final para envio de propostas
  status: 'Aberta' | 'Fechada' | 'Concluída' | 'Pausada';
  counterProposalTimeInMinutes?: number;
  counterProposalReminderPercentage?: number;
  aiInterventionPercentage?: number;
  userId: string; // To scope quotations to a user
  createdAt: Timestamp | FieldValue;
  createdBy: string; // ID do usuário que criou (placeholder for now)
  name?: string; // Optional user-defined name for the quotation
}

export interface Offer {
  id?: string; // Firestore document ID
  supplierId: string;
  supplierName: string;
  supplierInitials: string; // Ex: "JG" para Juliana G.
  pricePerUnit: number;
  brandOffered: string;
  packagingDescription: string;
  unitsInPackaging: number;
  totalPackagingPrice: number;
  updatedAt: Timestamp | FieldValue;
  createdAt?: Timestamp | FieldValue; // Added to track when offer was created
  productId: string; // Added to explicitly link offer to product within the offer data itself
}


// Unified message type for the 'incoming_messages' collection
export interface IncomingMessage {
  id: string;
  isOutgoing: boolean; // true for messages sent from the system, false for messages received from users
  phoneNumber: string; // The supplier/customer's phone number
  supplierName: string; // Denormalized supplier name for easy display
  message: string;
  status: 'received' | 'pending' | 'sent' | 'failed' | 'read';
  userId: string;
  createdAt: Timestamp | FieldValue;
  updatedAt: Timestamp | FieldValue;
  sentAt?: Timestamp | FieldValue;
  error?: string; // To log any sending errors
}


export interface WhatsAppStatus {
  status: 'disconnected' | 'connected' | 'needs_qr' | 'initializing' | 'creating' | 'authenticated';
  qrDataUri?: string | null;
  readyAt?: Timestamp | FieldValue;
  disconnectedAt?: Timestamp | FieldValue;
  generatedAt?: Timestamp | FieldValue;
  error?: string;
}

export interface WhatsAppSessionRequest {
  userId: string;
  status: 'requested' | 'processing' | 'active' | 'failed';
  requestedAt: Timestamp | FieldValue;
  processedAt?: Timestamp | FieldValue;
}
