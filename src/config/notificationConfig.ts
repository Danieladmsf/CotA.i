/**
 * Centralized Notification System Configuration
 *
 * This file contains ALL configuration for notification types.
 * To add a new notification type:
 * 1. Add the type to NotificationType enum in types/index.ts
 * 2. Add configuration here in NOTIFICATION_CONFIG
 * 3. Create a specific function in notificationService.ts (optional, for convenience)
 *
 * That's it! The UI components will automatically support the new type.
 */

import type { NotificationType } from '@/types';
import {
  AlertCircle,
  Check,
  X,
  TrendingUp,
  TrendingDown,
  CheckCheck,
  Package,
  Award,
  Clock,
  MessageSquare,
  Edit3,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Context determines which user sees the notification
 */
export type NotificationContext = 'buyer' | 'supplier' | 'both';

/**
 * Priority determines visual emphasis and sorting
 */
export type NotificationPriority = 'low' | 'medium' | 'high';

/**
 * Configuration for a single notification type
 */
export interface NotificationTypeConfig {
  /** Human-readable label */
  label: string;

  /** Lucide icon component */
  icon: LucideIcon;

  /** Tailwind CSS classes for color (text + background) */
  colorClasses: string;

  /** Who should see this notification */
  context: NotificationContext;

  /** Default priority level */
  defaultPriority: NotificationPriority;

  /** Default action URL pattern (use {quotationId}, {productId} as placeholders) */
  defaultActionUrl?: string;

  /** Short description for documentation */
  description: string;
}

/**
 * CENTRALIZED NOTIFICATION CONFIGURATION
 *
 * Add new notification types here. All UI components will automatically support them.
 */
export const NOTIFICATION_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  // ============================================================================
  // BRAND APPROVAL NOTIFICATIONS
  // ============================================================================

  brand_approval_pending: {
    label: 'Aprovação de Marca Pendente',
    icon: AlertCircle,
    colorClasses: 'text-orange-600 bg-orange-100',
    context: 'buyer',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?tab=aprovacoes',
    description: 'Fornecedor propôs uma nova marca que precisa ser aprovada pelo comprador'
  },

  brand_approval_approved: {
    label: 'Marca Aprovada',
    icon: Check,
    colorClasses: 'text-green-600 bg-green-100',
    context: 'supplier',
    defaultPriority: 'medium',
    defaultActionUrl: '/portal/{supplierId}/cotar/{quotationId}',
    description: 'Marca sugerida pelo fornecedor foi aprovada pelo comprador'
  },

  brand_approval_rejected: {
    label: 'Marca Rejeitada',
    icon: X,
    colorClasses: 'text-red-600 bg-red-100',
    context: 'supplier',
    defaultPriority: 'low',
    defaultActionUrl: '/portal/{supplierId}/cotar/{quotationId}',
    description: 'Marca sugerida pelo fornecedor foi rejeitada pelo comprador'
  },

  // ============================================================================
  // QUANTITY VARIATION NOTIFICATIONS
  // ============================================================================

  quantity_variation_detected: {
    label: 'Variação de Quantidade Detectada',
    icon: TrendingUp,
    colorClasses: 'text-blue-600 bg-blue-100',
    context: 'buyer',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}&tab=aprovacoes-quantidade',
    description: 'Fornecedor ofereceu quantidade diferente da solicitada'
  },

  buyer_quantity_adjustment_requested: {
    label: 'Ajuste de Quantidade Solicitado',
    icon: Edit3,
    colorClasses: 'text-purple-600 bg-purple-100',
    context: 'supplier',
    defaultPriority: 'high',
    defaultActionUrl: '/portal/{supplierId}/cotar/{quotationId}?tab=ajustes',
    description: 'Comprador solicitou ajuste nas quantidades oferecidas'
  },

  buyer_adjustment_applied: {
    label: 'Oferta Ajustada pelo Comprador',
    icon: Edit3,
    colorClasses: 'text-blue-600 bg-blue-100',
    context: 'supplier',
    defaultPriority: 'medium',
    defaultActionUrl: '/portal/{supplierId}/cotar/{quotationId}',
    description: 'Comprador ajustou automaticamente sua oferta'
  },

  quantity_adjustment_approved: {
    label: 'Ajuste de Quantidade Aprovado',
    icon: CheckCircle2,
    colorClasses: 'text-green-600 bg-green-100',
    context: 'buyer',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}&tab=aprovacoes-quantidade',
    description: 'Fornecedor aprovou o ajuste de quantidade solicitado'
  },

  quantity_adjustment_rejected: {
    label: 'Ajuste de Quantidade Recusado',
    icon: XCircle,
    colorClasses: 'text-red-600 bg-red-100',
    context: 'buyer',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}&tab=aprovacoes-quantidade',
    description: 'Fornecedor recusou o ajuste de quantidade solicitado'
  },

  // ============================================================================
  // QUOTATION LIFECYCLE NOTIFICATIONS
  // ============================================================================

  quotation_started: {
    label: 'Cotação Iniciada',
    icon: TrendingUp,
    colorClasses: 'text-blue-600 bg-blue-100',
    context: 'buyer',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}',
    description: 'Nova cotação foi criada e enviada aos fornecedores'
  },

  quotation_closed: {
    label: 'Cotação Encerrada',
    icon: CheckCheck,
    colorClasses: 'text-gray-600 bg-gray-100',
    context: 'both',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}',
    description: 'Cotação foi encerrada e não aceita mais ofertas'
  },

  // ============================================================================
  // OFFER NOTIFICATIONS
  // ============================================================================

  offer_received: {
    label: 'Oferta Recebida',
    icon: Package,
    colorClasses: 'text-purple-600 bg-purple-100',
    context: 'buyer',
    defaultPriority: 'medium',
    defaultActionUrl: '/cotacao?quotation={quotationId}',
    description: 'Fornecedor enviou uma nova oferta'
  },

  offer_outbid: {
    label: 'Oferta Superada',
    icon: Award,
    colorClasses: 'text-yellow-600 bg-yellow-100',
    context: 'buyer',
    defaultPriority: 'medium',
    defaultActionUrl: '/cotacao?quotation={quotationId}',
    description: 'Uma oferta foi superada por outra melhor'
  },

  // ============================================================================
  // DEADLINE NOTIFICATIONS
  // ============================================================================

  deadline_approaching: {
    label: 'Prazo se Aproximando',
    icon: Clock,
    colorClasses: 'text-red-600 bg-red-100',
    context: 'both',
    defaultPriority: 'high',
    defaultActionUrl: '/cotacao?quotation={quotationId}',
    description: 'O prazo para envio de ofertas está se aproximando'
  },

  // ============================================================================
  // SYSTEM NOTIFICATIONS
  // ============================================================================

  system_message: {
    label: 'Mensagem do Sistema',
    icon: MessageSquare,
    colorClasses: 'text-blue-600 bg-blue-100',
    context: 'both',
    defaultPriority: 'medium',
    defaultActionUrl: '/cotacao',
    description: 'Mensagem geral do sistema'
  },
};

/**
 * Helper function to get notification configuration
 */
export function getNotificationConfig(type: NotificationType): NotificationTypeConfig {
  return NOTIFICATION_CONFIG[type];
}

/**
 * Get all notification types for a specific context
 */
export function getNotificationTypesForContext(context: NotificationContext): NotificationType[] {
  return Object.entries(NOTIFICATION_CONFIG)
    .filter(([_, config]) => config.context === context || config.context === 'both')
    .map(([type, _]) => type as NotificationType);
}

/**
 * Check if a notification type should be visible to a specific context
 */
export function isNotificationVisibleToContext(
  type: NotificationType,
  context: NotificationContext
): boolean {
  const config = NOTIFICATION_CONFIG[type];
  return config.context === context || config.context === 'both';
}

/**
 * Build action URL with dynamic values
 */
export function buildNotificationActionUrl(
  type: NotificationType,
  values: {
    quotationId?: string;
    productId?: string;
    supplierId?: string;
    [key: string]: string | undefined;
  }
): string {
  const config = NOTIFICATION_CONFIG[type];
  if (!config.defaultActionUrl) return '/cotacao';

  let url = config.defaultActionUrl;

  // Replace placeholders
  Object.entries(values).forEach(([key, value]) => {
    if (value) {
      url = url.replace(`{${key}}`, value);
    }
  });

  // Remove any remaining placeholders
  url = url.replace(/\{[^}]+\}/g, '');

  return url;
}
