'use client';

/**
 * DEPRECATED: This hook is no longer needed as notifications are now created
 * directly by the server-side API route /api/brand-request when a brand request is submitted.
 *
 * The API route uses the centralized notification service from @/actions/notificationService
 * which provides better reliability and consistency across the application.
 *
 * This hook remains as a no-op to avoid breaking existing imports.
 * It can be safely removed from layouts/components in the future.
 */
export const useNotificationWatcher = () => {
  // No-op: Notifications are now created server-side by /api/brand-request
  // See: src/app/api/brand-request/route.ts (notifyBrandApprovalPending)
  return null;
};