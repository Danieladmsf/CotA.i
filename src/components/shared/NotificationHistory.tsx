'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  Bell, 
  Check, 
  CheckCheck, 
  Filter, 
  Calendar,
  ChevronDown,
  Loader2,
  AlertCircle,
  Package,
  Building2,
  Award,
  Clock,
  TrendingUp,
  MessageSquare,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, type NotificationFilters } from '@/hooks/useNotifications';
import type { SystemNotification, NotificationType } from '@/types';

interface NotificationHistoryProps {
  isOpen: boolean;
  onClose: () => void;
  quotations?: { id: string; name: string; date: Date }[];
}

const NotificationTypeLabels: Record<NotificationType, string> = {
  brand_approval_pending: 'Aprovação de Marca Pendente',
  brand_approval_approved: 'Marca Aprovada',
  brand_approval_rejected: 'Marca Rejeitada',
  quotation_started: 'Cotação Iniciada',
  quotation_closed: 'Cotação Encerrada',
  offer_received: 'Oferta Recebida',
  offer_outbid: 'Oferta Superada',
  deadline_approaching: 'Prazo se Aproximando',
  system_message: 'Mensagem do Sistema'
};

const NotificationTypeIcons: Record<NotificationType, React.ElementType> = {
  brand_approval_pending: AlertCircle,
  brand_approval_approved: Check,
  brand_approval_rejected: X,
  quotation_started: TrendingUp,
  quotation_closed: CheckCheck,
  offer_received: Package,
  offer_outbid: Award,
  deadline_approaching: Clock,
  system_message: MessageSquare
};

const NotificationTypeColors: Record<NotificationType, string> = {
  brand_approval_pending: 'text-orange-600 bg-orange-100',
  brand_approval_approved: 'text-green-600 bg-green-100',
  brand_approval_rejected: 'text-red-600 bg-red-100',
  quotation_started: 'text-blue-600 bg-blue-100',
  quotation_closed: 'text-gray-600 bg-gray-100',
  offer_received: 'text-purple-600 bg-purple-100',
  offer_outbid: 'text-yellow-600 bg-yellow-100',
  deadline_approaching: 'text-red-600 bg-red-100',
  system_message: 'text-blue-600 bg-blue-100'
};

export default function NotificationHistory({ isOpen, onClose, quotations = [] }: NotificationHistoryProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<NotificationFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  
  const { 
    notifications, 
    unreadCount, 
    isLoading, 
    hasMore, 
    markAsRead, 
    markAllAsRead, 
    loadMore, 
    refresh 
  } = useNotifications(filters);

  const handleNotificationClick = async (notification: SystemNotification) => {
    if (!notification.isRead) {
      await markAsRead(notification.id);
    }
    
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
      onClose();
    }
  };

  const handleFilterChange = (key: keyof NotificationFilters, value: any) => {
    setFilters(prev => ({
      ...prev,
      [key]: value === 'all' ? undefined : value
    }));
  };

  const clearFilters = () => {
    setFilters({});
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMins = Math.floor(diffInMs / (1000 * 60));
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

    if (diffInMins < 1) return 'Agora mesmo';
    if (diffInMins < 60) return `${diffInMins}min atrás`;
    if (diffInHours < 24) return `${diffInHours}h atrás`;
    if (diffInDays < 7) return `${diffInDays}d atrás`;
    
    return format(date, "dd/MM/yy", { locale: ptBR });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl h-[80vh] flex flex-col">
        <CardHeader className="border-b flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5" />
                Notificações
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-2">
                    {unreadCount}
                  </Badge>
                )}
              </CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-1"
              >
                <Filter className="h-4 w-4" />
                Filtros
                <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
              </Button>
              {unreadCount > 0 && (
                <Button variant="ghost" size="sm" onClick={markAllAsRead}>
                  <CheckCheck className="h-4 w-4 mr-1" />
                  Marcar Tudo Lido
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Quotation Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Cotação</label>
                  <Select 
                    value={filters.quotationId || 'all'} 
                    onValueChange={(value) => handleFilterChange('quotationId', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas as cotações" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as cotações</SelectItem>
                      {quotations.map(quotation => (
                        <SelectItem key={quotation.id} value={quotation.id}>
                          {quotation.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Type Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Tipo</label>
                  <Select 
                    value={filters.type || 'all'} 
                    onValueChange={(value) => handleFilterChange('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {Object.entries(NotificationTypeLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Status Filter */}
                <div>
                  <label className="text-sm font-medium mb-1 block">Status</label>
                  <Select 
                    value={filters.isRead === undefined ? 'all' : filters.isRead.toString()} 
                    onValueChange={(value) => handleFilterChange('isRead', value === 'all' ? undefined : value === 'true')}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="false">Não lidas</SelectItem>
                      <SelectItem value="true">Lidas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpar Filtros
                </Button>
                <Button variant="outline" size="sm" onClick={refresh}>
                  Atualizar
                </Button>
              </div>
            </div>
          )}
        </CardHeader>

        <CardContent className="flex-1 p-0">
          <ScrollArea className="h-full">
            {isLoading && notifications.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span className="ml-2">Carregando notificações...</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center p-6">
                <Bell className="h-12 w-12 text-muted-foreground mb-2" />
                <p className="text-muted-foreground font-medium">Nenhuma notificação encontrada</p>
                <p className="text-sm text-muted-foreground mt-1">
                  As notificações aparecerão aqui quando houver atividade
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {notifications.map((notification, index) => {
                  const Icon = NotificationTypeIcons[notification.type];
                  const colorClasses = NotificationTypeColors[notification.type];
                  const createdAt = (notification.createdAt as any).toDate();

                  return (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors ${
                        !notification.isRead ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-full ${colorClasses}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className={`text-sm font-medium ${!notification.isRead ? 'font-semibold' : ''}`}>
                                {notification.title}
                              </h4>
                              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                {notification.message}
                              </p>
                              
                              {/* Additional Info */}
                              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                {notification.quotationName && (
                                  <span className="flex items-center gap-1">
                                    <Building2 className="h-3 w-3" />
                                    {notification.quotationName}
                                  </span>
                                )}
                                {notification.supplierName && (
                                  <span className="flex items-center gap-1">
                                    <Package className="h-3 w-3" />
                                    {notification.supplierName}
                                  </span>
                                )}
                                <Badge variant="outline" className="text-xs">
                                  {NotificationTypeLabels[notification.type]}
                                </Badge>
                              </div>
                            </div>
                            
                            <div className="text-xs text-muted-foreground flex flex-col items-end gap-1">
                              <span>{getRelativeTime(createdAt)}</span>
                              {!notification.isRead && (
                                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {hasMore && (
                  <div className="p-4 text-center">
                    <Button 
                      variant="outline" 
                      onClick={loadMore} 
                      disabled={isLoading}
                      className="w-full"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Carregando...
                        </>
                      ) : (
                        'Carregar Mais'
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}