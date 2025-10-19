'use client';

import { useState, useEffect, useMemo } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationHistory from './NotificationHistory';
import type { SystemNotification, Quotation } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getNotificationConfig,
  getNotificationTypesForContext,
  buildNotificationActionUrl,
  type NotificationContext
} from '@/config/notificationConfig';

interface NotificationBellProps {
  context?: NotificationContext;
  supplierId?: string;
}

/**
 * NotificationBell - 100% Generic Notification System
 *
 * This component automatically supports ANY notification type defined in notificationConfig.ts
 * No changes needed here when adding new notification types!
 *
 * @param context - 'buyer' or 'supplier' - determines which notifications to show
 * @param supplierId - Required when context is 'supplier'
 */
export default function NotificationBell({ context = 'buyer', supplierId }: NotificationBellProps) {
  const { user } = useAuth();
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [quotations, setQuotations] = useState<{ id: string; name: string; date: Date }[]>([]);

  // Get valid notification types for this context from centralized config
  const validTypesForContext = useMemo(
    () => getNotificationTypesForContext(context),
    [context]
  );

  // Setup notification filters based on context
  const notificationFilters = useMemo(() => {
    if (context === 'supplier' && supplierId) {
      return { targetSupplierId: supplierId };
    }
    return {}; // For buyer, uses default userId logic from hook
  }, [context, supplierId]);

  // Use the notifications hook
  const {
    notifications: allNotifications,
    unreadCount: allUnreadCount,
    markAsRead,
    isLoading
  } = useNotifications(notificationFilters, 50); // Fetch more to ensure we have enough after filtering

  // Filter notifications to only show types valid for this context
  const contextNotifications = useMemo(() => {
    return allNotifications.filter(notification =>
      validTypesForContext.includes(notification.type)
    );
  }, [allNotifications, validTypesForContext]);

  // Get recent notifications (last 5)
  const recentNotifications = useMemo(() => {
    return contextNotifications.slice(0, 5);
  }, [contextNotifications]);

  // Calculate unread count for this context
  const unreadCount = useMemo(() => {
    return contextNotifications.filter(n => !n.isRead).length;
  }, [contextNotifications]);

  // Load quotations for filter (buyer only)
  useEffect(() => {
    if (!user?.uid || context !== 'buyer') return;

    try {
      const quotationsQuery = query(
        collection(db, 'quotations'),
        where('userId', '==', user.uid),
        orderBy('createdAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(
        quotationsQuery,
        (snapshot) => {
          const quotationsList = snapshot.docs.map(doc => {
            const data = doc.data() as Quotation;
            const createdAt = (data.createdAt as any).toDate();
            return {
              id: doc.id,
              name: data.name || `Cotação #${doc.id.slice(-6)} de ${format(createdAt, 'dd/MM/yy (HH:mm)', { locale: ptBR })}`,
              date: createdAt
            };
          });
          setQuotations(quotationsList);
        },
        (error) => {
          console.error('🔴 [NotificationBell] Error in quotations listener:', error);
        }
      );

      return () => unsubscribe();
    } catch (error) {
      console.error('Error loading quotations:', error);
    }
  }, [user?.uid, context]);

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }

    setShowDropdown(false);

    // Use actionUrl if provided, otherwise build from config
    let targetUrl = notification.actionUrl;

    if (!targetUrl) {
      targetUrl = buildNotificationActionUrl(notification.type, {
        quotationId: notification.quotationId,
        productId: notification.productId,
        supplierId: notification.supplierId || supplierId
      });
    }

    router.push(targetUrl);
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));

    if (diffInMins < 1) return 'Agora mesmo';
    if (diffInMins < 60) return `${diffInMins}min atrás`;
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    return format(date, 'dd/MM/yy', { locale: ptBR });
  };

  return (
    <>
      <Popover open={showDropdown} onOpenChange={setShowDropdown}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="end">
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="font-semibold">Notificações</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDropdown(false);
                setShowHistory(true);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Ver todas
            </Button>
          </div>

          <div className="max-h-[400px] overflow-y-auto">
            {isLoading ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Carregando...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação
              </div>
            ) : (
              recentNotifications.map((notification) => {
                const config = getNotificationConfig(notification.type);
                const Icon = config.icon;
                const createdAt = (notification.createdAt as any)?.toDate?.() || new Date();

                return (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`w-full text-left p-4 hover:bg-muted/50 transition-colors border-b last:border-b-0 ${
                      !notification.isRead ? 'bg-blue-50/50' : ''
                    }`}
                  >
                    <div className="flex gap-3">
                      <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${config.colorClasses}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm truncate">
                            {notification.title}
                          </p>
                          {!notification.isRead && (
                            <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-1" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {getRelativeTime(createdAt)}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </PopoverContent>
      </Popover>

      <NotificationHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
        quotations={quotations}
      />
    </>
  );
}
