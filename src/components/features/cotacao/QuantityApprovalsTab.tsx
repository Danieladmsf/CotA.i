'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, Timestamp, orderBy } from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Package, Calendar, User, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp, Edit3, Send } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SystemNotification } from '@/types';
import { requestQuantityAdjustment } from '@/actions/quantityAdjustmentActions';

// Helper to get unit abbreviation
const getUnitAbbr = (unit: string): string => {
  switch (unit) {
    case 'Kilograma(s)': return 'kg';
    case 'Litro(s)': return 'L';
    case 'Unidade(s)': return 'unid';
    case 'Grama(s)': return 'g';
    case 'Mililitro(s)': return 'ml';
    case 'Caixa(s)': return 'cx';
    case 'Pacote(s)': return 'pct';
    case 'Dúzia(s)': return 'dz';
    case 'Peça(s)': return 'pç';
    case 'Metro(s)': return 'm';
    default: return unit;
  }
};

export default function QuantityApprovalsTab({ quotationId }: { quotationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allNotifications, setAllNotifications] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'read'>('all');

  useEffect(() => {
    if (!user?.uid || !quotationId) return;

    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('quotationId', '==', quotationId),
      where('type', '==', 'quantity_variation_detected')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SystemNotification[];

        notifications.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.() || new Date(0);
          const bTime = (b.createdAt as any)?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });

        setAllNotifications(notifications);
        setIsLoading(false);
      },
      (error) => {
        console.error('[QuantityApprovalsTab] Error fetching notifications:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, quotationId]);

  const filteredNotifications = statusFilter === 'all'
    ? allNotifications
    : allNotifications.filter(notif => statusFilter === 'unread' ? !notif.isRead : notif.isRead);

  const unreadCount = allNotifications.filter(notif => !notif.isRead).length;
  const readCount = allNotifications.filter(notif => notif.isRead).length;

  const toggleCardExpansion = (notificationId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(notificationId)) {
        newSet.delete(notificationId);
      } else {
        newSet.add(notificationId);
      }
      return newSet;
    });
  };

  const handleMarkAsReviewed = async (notification: SystemNotification) => {
    if (!notification.id) return;
    setProcessingIds(prev => new Set(prev).add(notification.id));
    try {
      const notificationRef = doc(db, 'notifications', notification.id);
      await updateDoc(notificationRef, { isRead: true, readAt: Timestamp.now() });
      toast({ title: "Marcado como Revisado", description: `A variação para "${notification.productName}" foi marcada como revisada.` });
    } catch (error: any) {
      toast({ title: "Erro", description: `Erro ao marcar como revisado: ${error?.message || 'Desconhecido'}`, variant: "destructive" });
    } finally {
      setProcessingIds(prev => { const newSet = new Set(prev); newSet.delete(notification.id); return newSet; });
    }
  };

  const handleAcceptSuggestion = async (notification: SystemNotification, suggestion: { packages: number; totalQuantity: number; variation: number; totalPrice?: number; }) => {
    if (!notification.id || !suggestion) return;

    const offerId = notification.metadata?.offerId as string;
    const supplierId = notification.supplierId;

    if (!offerId || !supplierId) {
      toast({ title: "Erro", description: "Informações da oferta não encontradas na notificação.", variant: "destructive" });
      return;
    }

    setProcessingIds(prev => new Set(prev).add(notification.id));

    try {
      const result = await requestQuantityAdjustment({
        notificationId: notification.id,
        quotationId: quotationId,
        productId: notification.productId || '',
        offerId: offerId,
        supplierId: supplierId,
        adjustedBoxes: suggestion.packages,
        adjustedUnitsInPackaging: notification.metadata?.originalOffer?.unitsPerPackage || notification.metadata?.unitsInPackaging || 1,
      });

      if (result.success) {
        toast({
          title: "Ajuste Solicitado",
          description: `Proposta de ajuste para ${suggestion.packages} caixas foi enviada para ${notification.supplierName}.`,
          variant: "default"
        });
        setAllNotifications(prev => prev.map(n => n.id === notification.id ? { ...n, isRead: true, metadata: { ...n.metadata, adjustmentRequested: true } } : n));
      } else {
        toast({ title: "Erro ao Solicitar Ajuste", description: result.error || "Ocorreu um erro desconhecido.", variant: "destructive" });
      }
    } catch (error: any) {
      console.error('[QuantityApprovals] Error accepting suggestion:', error);
      toast({ title: "Erro Crítico", description: `Erro ao processar ajuste: ${error?.message || 'Desconhecido'}`, variant: "destructive" });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(notification.id);
        return newSet;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando variações de quantidade...</span>
      </div>
    );
  }

  if (allNotifications.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma variação de quantidade</h3>
        <p className="text-muted-foreground">Não há variações de quantidade detectadas para esta cotação.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Variações de Quantidade</h2>
            <p className="text-muted-foreground">{allNotifications.length} variação(ões) detectada(s) | {unreadCount} não revisada(s)</p>
          </div>
        </div>
        <div className="flex gap-2 border-b">
          <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 font-medium transition-colors relative ${statusFilter === 'all' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Todas <Badge variant="secondary" className="ml-2">{allNotifications.length}</Badge>
          </button>
          <button onClick={() => setStatusFilter('unread')} className={`px-4 py-2 font-medium transition-colors relative ${statusFilter === 'unread' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Não Revisadas <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">{unreadCount}</Badge>
          </button>
          <button onClick={() => setStatusFilter('read')} className={`px-4 py-2 font-medium transition-colors relative ${statusFilter === 'read' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Revisadas <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">{readCount}</Badge>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredNotifications.map((notification) => {
          const isProcessing = processingIds.has(notification.id);
          const isExpanded = expandedCards.has(notification.id);
          const isUnread = !notification.isRead;

          const metadata = notification.metadata || {};
          const variationType = metadata.variationType as 'over' | 'under';
          const variationAmount = metadata.variationAmount as number || 0;
          const variationPercentage = metadata.variationPercentage as number || 0;
          const requestedQuantity = metadata.requestedQuantity as number || 0;
          const offeredQuantity = metadata.offeredQuantity as number || 0;
          const unit = metadata.unit as string || '';
          const adjustmentRequested = metadata.adjustmentRequested as boolean;

          const isShortage = variationType === 'under';
          const borderColor = isUnread ? 'border-l-orange-500' : 'border-l-gray-300';
          const VariationIcon = isShortage ? TrendingDown : TrendingUp;
          const variationColor = isShortage ? 'text-red-600' : 'text-blue-600';
          const variationBgColor = isShortage ? 'bg-red-50' : 'bg-blue-50';

          return (
            <Card key={notification.id} className={`border-l-4 ${borderColor} transition-all duration-200`}>
              <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-4" onClick={() => toggleCardExpansion(notification.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 ${variationBgColor} rounded-lg flex items-center justify-center`}><VariationIcon className={`h-6 w-6 ${variationColor}`} /></div>
                    <div>
                      <CardTitle className="text-lg">{notification.productName}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{notification.supplierName}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{notification.createdAt && (notification.createdAt as any).toDate ? format((notification.createdAt as any).toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Data não disponível'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isUnread ? <Badge variant="outline" className="border-orange-600 text-orange-700">Aguardando Revisão</Badge> : <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">✓ Revisada</Badge>}
                    {isExpanded ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="space-y-4 pt-0">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Quantidade Solicitada</p>
                      <p className="font-semibold text-lg">{requestedQuantity.toFixed(1)} {getUnitAbbr(unit)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Quantidade Oferecida</p>
                      <p className="font-semibold text-lg">{offeredQuantity.toFixed(1)} {getUnitAbbr(unit)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Variação</p>
                      <p className={`font-semibold text-lg flex items-center gap-1 ${variationColor}`}><VariationIcon className="h-4 w-4" />{isShortage ? '' : '+'}{variationAmount.toFixed(1)} {getUnitAbbr(unit)} ({variationPercentage.toFixed(1)}%)</p>
                    </div>
                  </div>

                  {notification.brandName && <div className="p-3 bg-muted/20 rounded-lg"><p className="text-sm font-medium text-muted-foreground mb-1">Marca Oferecida</p><p className="font-semibold">{notification.brandName}</p></div>}

                  {isShortage && !adjustmentRequested && <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="h-5 w-5 text-red-600 mt-0.5" /><div><p className="font-medium text-red-900">Atenção: Quantidade Abaixo do Solicitado</p><p className="text-sm text-red-700">O fornecedor enviará menos do que foi solicitado. Verifique se isso é aceitável para sua operação.</p></div></div>}
                  {!isShortage && !adjustmentRequested && <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"><AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" /><div><p className="font-medium text-blue-900">Atenção: Quantidade Acima do Solicitado</p><p className="text-sm text-blue-700">O fornecedor enviará mais do que foi solicitado. Verifique se isso é aceitável para sua operação.</p></div></div>}

                  {adjustmentRequested && <div className={`p-3 rounded-lg border ${metadata.adjustmentStatus === 'approved' ? 'bg-green-50 border-green-200' : metadata.adjustmentStatus === 'rejected' ? 'bg-red-50 border-red-200' : 'bg-purple-50 border-purple-200'}`}><div className="flex items-center gap-2">{metadata.adjustmentStatus === 'approved' && <><CheckCircle className="h-5 w-5 text-green-600" /><div><p className="font-medium text-green-900">Ajuste Aprovado</p><p className="text-sm text-green-700">O fornecedor aceitou enviar {metadata.adjustedBoxes} caixas.</p></div></>}{metadata.adjustmentStatus === 'rejected' && <><XCircle className="h-5 w-5 text-red-600" /><div><p className="font-medium text-red-900">Ajuste Recusado</p><p className="text-sm text-red-700">{metadata.rejectionReason || 'O fornecedor não pode atender a quantidade ajustada'}</p></div></>}{metadata.adjustmentStatus !== 'approved' && metadata.adjustmentStatus !== 'rejected' && <><Loader2 className="h-5 w-5 text-purple-600 animate-spin" /><div><p className="font-medium text-purple-900">Aguardando Resposta</p><p className="text-sm text-purple-700">Proposta de ajuste enviada para {metadata.adjustedBoxes} caixas.</p></div></>}</div ></div>}

                  {isUnread && !adjustmentRequested && metadata.suggestions && (metadata.suggestions.floor || metadata.suggestions.ceil) && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-blue-600" /><p className="font-semibold text-blue-900">Ajuste Inteligente de Quantidade</p></div>
                      <p className="text-sm text-blue-800">O fornecedor não pode atender exatamente <strong>{requestedQuantity.toFixed(1)} {getUnitAbbr(unit)}</strong>. Escolha uma das opções abaixo para ajustar o pedido:</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {metadata.suggestions.floor && (
                          <Button variant="outline" className="h-auto bg-white border-2 border-gray-300 rounded-lg hover:border-red-500 transition-colors cursor-pointer flex flex-col items-start text-left p-3" onClick={() => handleAcceptSuggestion(notification, metadata.suggestions.floor)} disabled={isProcessing}>
                            <span className="font-bold text-lg text-gray-800">{metadata.suggestions.floor.packages} {metadata.suggestions.floor.packages > 1 ? 'caixas' : 'caixa'}</span>
                            <span className="font-semibold text-md">{metadata.suggestions.floor.totalQuantity.toFixed(1)} {getUnitAbbr(unit)}</span>
                            <Badge variant="destructive" className="mt-1">Faltam {Math.abs(metadata.suggestions.floor.variation).toFixed(1)} {getUnitAbbr(unit)}</Badge>
                            {metadata.suggestions.floor.totalPrice !== undefined && <span className="text-sm font-bold text-gray-600 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.suggestions.floor.totalPrice)}</span>}
                          </Button>
                        )}
                        {metadata.suggestions.ceil && (
                          <Button variant="outline" className="h-auto bg-white border-2 border-gray-300 rounded-lg hover:border-green-500 transition-colors cursor-pointer flex flex-col items-start text-left p-3" onClick={() => handleAcceptSuggestion(notification, metadata.suggestions.ceil)} disabled={isProcessing}>
                            <span className="font-bold text-lg text-gray-800">{metadata.suggestions.ceil.packages} {metadata.suggestions.ceil.packages > 1 ? 'caixas' : 'caixa'}</span>
                            <span className="font-semibold text-md">{metadata.suggestions.ceil.totalQuantity.toFixed(1)} {getUnitAbbr(unit)}</span>
                            <Badge variant="secondary" className="mt-1 bg-orange-200 text-orange-800">Excesso de {metadata.suggestions.ceil.variation.toFixed(1)} {getUnitAbbr(unit)}</Badge>
                            {metadata.suggestions.ceil.totalPrice !== undefined && <span className="text-sm font-bold text-gray-600 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.suggestions.ceil.totalPrice)}</span>}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8"><AvatarFallback className="bg-orange-100 text-orange-800">{notification.supplierName?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '??'}</AvatarFallback></Avatar>
                      <div><p className="text-sm font-medium">{notification.supplierName}</p><p className="text-xs text-muted-foreground">Fornecedor</p></div>
                    </div>
                    {isUnread && !adjustmentRequested && <div className="flex items-center gap-3"><Button size="sm" onClick={(e) => { e.stopPropagation(); handleMarkAsReviewed(notification); }} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">{isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}Marcar como Revisada</Button></div>}
                    {!isUnread && <div className="text-sm text-muted-foreground">Revisada em {format((notification.readAt as any)?.toDate?.() || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}