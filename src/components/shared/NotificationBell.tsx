'use client';

import { useState, useEffect } from 'react';
import { Bell, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { useNotifications } from '@/hooks/useNotifications';
import NotificationHistory from './NotificationHistory';
import type { SystemNotification, Quotation, PendingBrandRequest } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { useMemo } from 'react';

export default function NotificationBell() {
  const { user } = useAuth();
  const router = useRouter();
  const [showHistory, setShowHistory] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [quotations, setQuotations] = useState<{ id: string; name: string; date: Date }[]>([]);
  const [fallbackPendingCount, setFallbackPendingCount] = useState(0);
  const [hasNotificationAccess, setHasNotificationAccess] = useState(true);
  
  const filters = useMemo(() => ({}), []);
  // Use the notifications hook for recent notifications in dropdown
  const { notifications: recentNotifications, unreadCount, markAsRead, isLoading } = useNotifications(filters, 5);

  // Fallback to pending brand requests if notifications system is not available
  useEffect(() => {
    if (!user?.uid) return;
    
    // If we have notifications access and they're loaded, don't use fallback
    if (!isLoading && unreadCount >= 0) {
      setHasNotificationAccess(true);
      return;
    }

    // Set up fallback monitoring for pending requests
    let fallbackUnsubscribe: (() => void) | null = null;
    
    try {
      const fallbackQuery = query(
        collection(db, 'pending_brand_requests'),
        where('userId', '==', user.uid),
        where('status', '==', 'pending')
      );

      fallbackUnsubscribe = onSnapshot(
        fallbackQuery,
        (snapshot) => {
          setFallbackPendingCount(snapshot.size);
          // If we have pending requests but notifications system seems broken, use fallback
          if (snapshot.size > 0 && unreadCount === 0 && !isLoading) {
            setHasNotificationAccess(false);
          }
        },
        (error) => {
          console.error('🔴 [NotificationBell] Error in fallback pending_brand_requests listener:', error);
          // If even fallback fails, assume notifications system should be primary
          setHasNotificationAccess(true);
        }
      );
    } catch (error) {
      console.error('Error setting up fallback system:', error);
      setHasNotificationAccess(true);
    }

    return () => {
      if (fallbackUnsubscribe) fallbackUnsubscribe();
    };
  }, [user?.uid, unreadCount, isLoading]);

  // Load quotations for filter
  useEffect(() => {
    if (!user?.uid) return;

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
  }, [user?.uid]);

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    setShowDropdown(false);
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    } else {
      // Default navigation based on type
      switch (notification.type) {
        case 'brand_approval_pending':
        case 'brand_approval_approved':
        case 'brand_approval_rejected':
          router.push('/cotacao?tab=aprovacoes');
          break;
        case 'quotation_started':
        case 'quotation_closed':
        case 'offer_received':
        case 'offer_outbid':
          if (notification.quotationId) {
            router.push(`/cotacao?quotation=${notification.quotationId}`);
          } else {
            router.push('/cotacao');
          }
          break;
        default:
          router.push('/cotacao');
      }
    }
  };

  const handleFallbackClick = () => {
    setShowDropdown(false);
    router.push('/cotacao?tab=aprovacoes');
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    
    if (diffInMins < 1) return 'Agora mesmo';
    if (diffInMins < 60) return `${diffInMins}min atrás`;
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    
    return format(date, "dd/MM HH:mm", { locale: ptBR });
  };

  // Determine which count to show
  const displayCount = hasNotificationAccess ? unreadCount : fallbackPendingCount;

  // Always show notification bell for logged-in users
  // The bell serves as access point to notifications/approvals even when count is 0
  if (!user?.uid) return null;

  return (
    <>
      <div className="relative">
        <Popover open={showDropdown} onOpenChange={setShowDropdown}>
          <PopoverTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon"
              className="relative hover:bg-orange-50"
            >
              <Bell className="h-5 w-5" />
              {displayCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-orange-600 hover:bg-orange-700"
                >
                  {displayCount > 9 ? '9+' : displayCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          
          <PopoverContent className="w-80 p-0" align="end">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Bell className="h-4 w-4" />
                {hasNotificationAccess ? 'Notificações' : 'Aprovações Pendentes'}
                {displayCount > 0 && (
                  <Badge variant="secondary" className="text-xs">
                    {displayCount}
                  </Badge>
                )}
              </h3>
              {hasNotificationAccess && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowHistory(true);
                  }}
                  className="text-xs"
                >
                  Ver todas
                </Button>
              )}
            </div>
            
            <div className="max-h-80 overflow-y-auto">
              {hasNotificationAccess ? (
                // Full notification system
                recentNotifications.length === 0 ? (
                  <div className="p-4 text-center text-muted-foreground">
                    <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  <div className="divide-y">
                    {recentNotifications.slice(0, 5).map((notification) => {
                      const createdAt = (notification.createdAt as any).toDate();
                      return (
                        <div
                          key={notification.id}
                          className={`p-3 hover:bg-muted/50 cursor-pointer transition-colors ${
                            !notification.isRead ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''
                          }`}
                          onClick={() => handleNotificationClick(notification)}
                        >
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm ${!notification.isRead ? 'font-semibold' : 'font-medium'}`}>
                                {notification.title}
                              </p>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1"></div>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {notification.message}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {getRelativeTime(createdAt)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                // Fallback to pending requests
                <div className="p-4 text-center">
                  <div className="bg-orange-50 border-l-2 border-l-orange-500 p-3 cursor-pointer" onClick={handleFallbackClick}>
                    <p className="text-sm font-medium">
                      {fallbackPendingCount} aprovação(ões) de marca pendente(s)
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Clique para revisar
                    </p>
                  </div>
                </div>
              )}
            </div>
            
            {hasNotificationAccess && recentNotifications.length > 0 && (
              <div className="p-3 border-t bg-muted/30">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full justify-center"
                  onClick={() => {
                    setShowDropdown(false);
                    setShowHistory(true);
                  }}
                >
                  Ver histórico completo
                  <ChevronDown className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Notification History Modal - only show if we have notifications access */}
      {hasNotificationAccess && (
        <NotificationHistory 
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          quotations={quotations}
        />
      )}
    </>
  );
}