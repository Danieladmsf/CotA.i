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
import { CheckCircle, XCircle, AlertCircle, Package, Calendar, User, TrendingUp, TrendingDown, Loader2, ChevronDown, ChevronUp, Edit3, Send, Clock } from 'lucide-react';
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
      async (snapshot) => {
        const notifications = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SystemNotification[];

        // Auto-fix: If adjustment is applied but notification is not marked as read, fix it
        const notificationsToFix = notifications.filter(notif => {
          const adjustmentApplied = notif.metadata?.adjustmentApplied;
          const isRead = notif.isRead;
          return adjustmentApplied && !isRead;
        });

        if (notificationsToFix.length > 0) {
          console.log(`[QuantityApprovalsTab] Auto-fixing ${notificationsToFix.length} inconsistent notifications`);

          // Fix all inconsistent notifications in parallel
          await Promise.all(
            notificationsToFix.map(async (notif) => {
              try {
                const notificationRef = doc(db, 'notifications', notif.id);
                await updateDoc(notificationRef, {
                  isRead: true,
                  readAt: Timestamp.now()
                });
                console.log(`[QuantityApprovalsTab] Fixed notification ${notif.id} (${notif.productName})`);
              } catch (error) {
                console.error(`[QuantityApprovalsTab] Failed to fix notification ${notif.id}:`, error);
              }
            })
          );
        }

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
        const unit = notification.metadata?.unit as string || '';
        toast({
          title: "Ajuste Aplicado com Sucesso",
          description: `A oferta de ${notification.supplierName} foi ajustada para ${suggestion.packages} caixas (${suggestion.totalQuantity.toFixed(1)} ${getUnitAbbr(unit)}).`,
          variant: "default"
        });

        // Mark notification as read in Firestore after successful adjustment
        try {
          const notificationRef = doc(db, 'notifications', notification.id);
          await updateDoc(notificationRef, {
            isRead: true,
            readAt: Timestamp.now()
          });
        } catch (updateError) {
          console.error('[QuantityApprovals] Error marking notification as read:', updateError);
          // Don't block the flow if marking as read fails
        }

        // Update local state
        setAllNotifications(prev => prev.map(n => n.id === notification.id ? {
          ...n,
          isRead: true,
          readAt: Timestamp.now(),
          metadata: {
            ...n.metadata,
            adjustmentApplied: true,
            adjustmentStatus: 'applied',
            adjustedBoxes: suggestion.packages
          }
        } : n));
      } else {
        toast({ title: "Erro ao Aplicar Ajuste", description: result.error || "Ocorreu um erro desconhecido.", variant: "destructive" });
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
          const adjustmentApplied = metadata.adjustmentApplied as boolean;
          const adjustmentStatus = metadata.adjustmentStatus as string;

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

                  {isShortage && !adjustmentApplied && <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg"><AlertCircle className="h-5 w-5 text-red-600 mt-0.5" /><div><p className="font-medium text-red-900">Atenção: Quantidade Abaixo do Solicitado</p><p className="text-sm text-red-700">O fornecedor enviará menos do que foi solicitado. Verifique se isso é aceitável para sua operação.</p></div></div>}
                  {!isShortage && !adjustmentApplied && <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg"><AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" /><div><p className="font-medium text-blue-900">Atenção: Quantidade Acima do Solicitado</p><p className="text-sm text-blue-700">O fornecedor enviará mais do que foi solicitado. Verifique se isso é aceitável para sua operação.</p></div></div>}

                  {adjustmentApplied && adjustmentStatus === 'applied' && (() => {
                    const adjustedBoxes = metadata.adjustedBoxes as number;

                    // Try to get weightPerUnit from new metadata first
                    let weightPerUnit = metadata.adjustedWeightPerUnit as number;
                    let finalQuantity = metadata.adjustedTotalQuantity as number;

                    // Detect suspicious data (likely saved incorrectly)
                    // If weightPerUnit is 1 or finalQuantity is very low compared to request, recalculate
                    const isSuspicious = (weightPerUnit === 1 && finalQuantity < requestedQuantity * 0.5) || !finalQuantity;

                    // For old notifications or suspicious data, recalculate from suggestions
                    if (!weightPerUnit || isSuspicious) {
                      const suggestions = metadata.suggestions as any;

                      console.log('🔍 DEBUG - Calculating for old notification:', {
                        adjustedBoxes,
                        suggestions,
                        hasFloor: !!suggestions?.floor,
                        hasCeil: !!suggestions?.ceil,
                        floorPackages: suggestions?.floor?.packages,
                        ceilPackages: suggestions?.ceil?.packages,
                        offeredQuantity: metadata.offeredQuantity
                      });

                      // Try to find the matching suggestion (floor or ceil) based on adjustedBoxes
                      let matchingSuggestion = null;
                      if (suggestions?.floor?.packages === adjustedBoxes) {
                        matchingSuggestion = suggestions.floor;
                        console.log('✓ Found floor match:', matchingSuggestion);
                      } else if (suggestions?.ceil?.packages === adjustedBoxes) {
                        matchingSuggestion = suggestions.ceil;
                        console.log('✓ Found ceil match:', matchingSuggestion);
                      }

                      if (matchingSuggestion) {
                        // Calculate weightPerUnit from the suggestion data
                        // For example: 90kg / 3 caixas = 30kg per caixa
                        weightPerUnit = matchingSuggestion.totalQuantity / matchingSuggestion.packages;
                        finalQuantity = matchingSuggestion.totalQuantity;
                        console.log('✓ Calculated from suggestion:', { weightPerUnit, finalQuantity });
                      } else {
                        // Fallback: try to calculate from offeredQuantity
                        const offeredQuantity = metadata.offeredQuantity as number;
                        console.log('⚠️ No matching suggestion, using fallback');
                        if (offeredQuantity && suggestions) {
                          // Use any available suggestion to get weightPerUnit
                          const anySuggestion = suggestions.floor || suggestions.ceil;
                          if (anySuggestion) {
                            weightPerUnit = anySuggestion.totalQuantity / anySuggestion.packages;
                            finalQuantity = adjustedBoxes * weightPerUnit;
                            console.log('✓ Calculated from any suggestion:', { weightPerUnit, finalQuantity });
                          } else {
                            weightPerUnit = 1;
                            finalQuantity = adjustedBoxes;
                            console.log('❌ Using default (1)');
                          }
                        } else {
                          weightPerUnit = 1;
                          finalQuantity = adjustedBoxes;
                          console.log('❌ Using default (1) - no data');
                        }
                      }
                    } else {
                      console.log('✓ Using saved metadata:', { weightPerUnit, finalQuantity });
                    }

                    const difference = finalQuantity - requestedQuantity;
                    const isBelow = difference < 0;

                    return (
                      <div className="p-4 rounded-lg border bg-green-50 border-green-200 space-y-2">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="font-medium text-green-900 mb-2">Ajuste Aplicado com Sucesso</p>
                            <div className="space-y-1 text-sm text-green-800">
                              <p>
                                <strong>Escolha aplicada:</strong> {adjustedBoxes} {adjustedBoxes > 1 ? 'caixas' : 'caixa'} de {weightPerUnit.toFixed(1)}{getUnitAbbr(unit)} = <strong>{finalQuantity.toFixed(1)} {getUnitAbbr(unit)}</strong>
                              </p>
                              <p>
                                <strong>Pedido original:</strong> {requestedQuantity.toFixed(1)} {getUnitAbbr(unit)}
                              </p>
                              <p>
                                <strong>Diferença:</strong> {isBelow ? 'Faltam' : 'Excesso de'} <span className={isBelow ? 'text-red-700 font-semibold' : 'text-orange-700 font-semibold'}>{Math.abs(difference).toFixed(1)} {getUnitAbbr(unit)}</span>
                              </p>
                            </div>
                            <p className="text-xs text-green-700 mt-2 italic">O fornecedor foi notificado sobre a alteração.</p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {!adjustmentApplied && metadata.suggestions && (metadata.suggestions.floor || metadata.suggestions.ceil || metadata.suggestions.offered) && (
                    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-3">
                      <div className="flex items-center gap-2"><AlertCircle className="h-5 w-5 text-blue-600" /><p className="font-semibold text-blue-900">Ajuste Inteligente de Quantidade</p></div>
                      <p className="text-sm text-blue-800">O fornecedor não pode atender exatamente <strong>{requestedQuantity.toFixed(1)} {getUnitAbbr(unit)}</strong>. Escolha uma das opções abaixo para ajustar o pedido:</p>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                        {metadata.suggestions.floor && (
                          <Button variant="outline" className="h-auto bg-white border-2 border-gray-300 rounded-lg hover:border-red-500 transition-colors cursor-pointer flex flex-col items-start text-left p-3" onClick={() => handleAcceptSuggestion(notification, metadata.suggestions.floor)} disabled={isProcessing}>
                            <span className="font-bold text-lg text-gray-800">{metadata.suggestions.floor.packages} {metadata.suggestions.floor.packages > 1 ? 'caixas' : 'caixa'}</span>
                            <span className="font-semibold text-md">{metadata.suggestions.floor.totalQuantity.toFixed(1)} {getUnitAbbr(unit)}</span>
                            <Badge variant="destructive" className="mt-1">Faltam {Math.abs(metadata.suggestions.floor.variation).toFixed(1)} {getUnitAbbr(unit)}</Badge>
                            {metadata.suggestions.floor.totalPrice !== undefined && <span className="text-sm font-bold text-gray-600 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.suggestions.floor.totalPrice)}</span>}
                          </Button>
                        )}
                        {metadata.suggestions.ceil && (
                          <Button variant="outline" className="h-auto bg-white border-2 border-gray-300 rounded-lg hover:border-blue-500 transition-colors cursor-pointer flex flex-col items-start text-left p-3" onClick={() => handleAcceptSuggestion(notification, metadata.suggestions.ceil)} disabled={isProcessing}>
                            <span className="font-bold text-lg text-gray-800">{metadata.suggestions.ceil.packages} {metadata.suggestions.ceil.packages > 1 ? 'caixas' : 'caixa'}</span>
                            <span className="font-semibold text-md">{metadata.suggestions.ceil.totalQuantity.toFixed(1)} {getUnitAbbr(unit)}</span>
                            <Badge variant="secondary" className="mt-1 bg-blue-200 text-blue-800">
                              {metadata.suggestions.ceil.variation > 0 ? `Excesso de ${metadata.suggestions.ceil.variation.toFixed(1)}` : `Exato`} {getUnitAbbr(unit)}
                            </Badge>
                            {metadata.suggestions.ceil.totalPrice !== undefined && <span className="text-sm font-bold text-gray-600 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.suggestions.ceil.totalPrice)}</span>}
                          </Button>
                        )}
                        {metadata.suggestions.offered && (
                          <Button variant="outline" className="h-auto bg-white border-2 border-orange-400 rounded-lg hover:border-orange-600 transition-colors cursor-pointer flex flex-col items-start text-left p-3 relative" onClick={() => handleAcceptSuggestion(notification, metadata.suggestions.offered)} disabled={isProcessing}>
                            <Badge variant="secondary" className="absolute -top-2 -right-2 bg-orange-500 text-white">Enviado</Badge>
                            <span className="font-bold text-lg text-gray-800">{metadata.suggestions.offered.packages} {metadata.suggestions.offered.packages > 1 ? 'caixas' : 'caixa'}</span>
                            <span className="font-semibold text-md">{metadata.suggestions.offered.totalQuantity.toFixed(1)} {getUnitAbbr(unit)}</span>
                            <Badge variant="secondary" className="mt-1 bg-orange-200 text-orange-800">
                              {metadata.suggestions.offered.variation > 0 ? `Excesso de ${metadata.suggestions.offered.variation.toFixed(1)}` : `Faltam ${Math.abs(metadata.suggestions.offered.variation).toFixed(1)}`} {getUnitAbbr(unit)}
                            </Badge>
                            {metadata.suggestions.offered.totalPrice !== undefined && <span className="text-sm font-bold text-gray-600 mt-2">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metadata.suggestions.offered.totalPrice)}</span>}
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
                    {isUnread && <div className="flex items-center gap-3"><Button size="sm" onClick={(e) => { e.stopPropagation(); handleMarkAsReviewed(notification); }} disabled={isProcessing} className="bg-green-600 hover:bg-green-700">{isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}Marcar como Revisada</Button></div>}
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