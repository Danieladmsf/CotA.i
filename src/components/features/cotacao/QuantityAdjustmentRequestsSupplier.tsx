'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, Timestamp } from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Package, Calendar, Loader2, ChevronDown, ChevronUp, Edit3 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SystemNotification } from '@/types';
import { handleQuantityAdjustmentResponse } from '@/actions/quantityAdjustmentActions';

interface QuantityAdjustmentRequestsSupplierProps {
  supplierId: string;
  quotationId: string;
}

export default function QuantityAdjustmentRequestsSupplier({
  supplierId,
  quotationId
}: QuantityAdjustmentRequestsSupplierProps) {
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!supplierId || !quotationId) return;

    // Query notifications of type 'buyer_quantity_adjustment_requested' for this supplier
    const notificationsQuery = query(
      collection(db, 'notifications'),
      where('targetSupplierId', '==', supplierId),
      where('quotationId', '==', quotationId),
      where('type', '==', 'buyer_quantity_adjustment_requested')
    );

    const unsubscribe = onSnapshot(
      notificationsQuery,
      (snapshot) => {
        const notifs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as SystemNotification[];

        // Sort by createdAt descending
        notifs.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.() || new Date(0);
          const bTime = (b.createdAt as any)?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });

        setNotifications(notifs);
        setIsLoading(false);
      },
      (error) => {
        console.error('[QuantityAdjustmentRequestsSupplier] Error fetching notifications:', error);
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [supplierId, quotationId]);

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

  const handleApprove = async (notification: SystemNotification) => {
    if (!notification.id) return;

    setProcessingIds(prev => new Set(prev).add(notification.id));

    try {
      const result = await handleQuantityAdjustmentResponse({
        supplierNotificationId: notification.id,
        approved: true
      });

      if (result.success) {
        toast({
          title: "Ajuste Aprovado",
          description: `O ajuste de quantidade para "${notification.productName}" foi aprovado com sucesso.`,
          variant: "default"
        });
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao aprovar ajuste",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[QuantityAdjustmentRequestsSupplier] Error approving:', error);
      toast({
        title: "Erro",
        description: `Erro ao aprovar ajuste: ${error?.message || 'Desconhecido'}`,
        variant: "destructive"
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(notification.id);
        return newSet;
      });
    }
  };

  const handleReject = async (notification: SystemNotification) => {
    if (!notification.id) return;

    const reason = rejectionReasons[notification.id];

    setProcessingIds(prev => new Set(prev).add(notification.id));

    try {
      const result = await handleQuantityAdjustmentResponse({
        supplierNotificationId: notification.id,
        approved: false,
        rejectionReason: reason
      });

      if (result.success) {
        toast({
          title: "Ajuste Recusado",
          description: `O ajuste de quantidade para "${notification.productName}" foi recusado.`,
          variant: "default"
        });

        // Clear rejection reason
        setRejectionReasons(prev => {
          const newReasons = { ...prev };
          delete newReasons[notification.id];
          return newReasons;
        });
      } else {
        toast({
          title: "Erro",
          description: result.error || "Erro ao recusar ajuste",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error('[QuantityAdjustmentRequestsSupplier] Error rejecting:', error);
      toast({
        title: "Erro",
        description: `Erro ao recusar ajuste: ${error?.message || 'Desconhecido'}`,
        variant: "destructive"
      });
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
        <span className="ml-2">Carregando solicitações de ajuste...</span>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma solicitação de ajuste</h3>
        <p className="text-muted-foreground">
          Não há solicitações de ajuste de quantidade pendentes para esta cotação.
        </p>
      </div>
    );
  }

  const pendingNotifications = notifications.filter(n => !n.isRead);
  const processedNotifications = notifications.filter(n => n.isRead);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ajustes de Quantidade Solicitados</h2>
        <p className="text-muted-foreground">
          {pendingNotifications.length} pendente(s) | {processedNotifications.length} processada(s)
        </p>
      </div>

      <div className="space-y-4">
        {notifications.map((notification) => {
          const isProcessing = processingIds.has(notification.id);
          const isExpanded = expandedCards.has(notification.id);
          const isPending = !notification.isRead;

          const metadata = notification.metadata || {};
          const originalOfferedBoxes = metadata.originalOfferedBoxes as number || 0;
          const adjustedBoxes = metadata.adjustedBoxes as number || 0;
          const originalUnitsInPackaging = metadata.originalUnitsInPackaging as number || 0;
          const adjustedUnitsInPackaging = metadata.adjustedUnitsInPackaging as number || 0;

          const borderColor = isPending ? 'border-l-purple-500' : 'border-l-gray-300';

          return (
            <Card key={notification.id} className={`border-l-4 ${borderColor} transition-all duration-200`}>
              {/* Compact Header */}
              <CardHeader
                className="cursor-pointer hover:bg-muted/30 transition-colors pb-4"
                onClick={() => toggleCardExpansion(notification.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                      <Edit3 className="h-6 w-6 text-purple-600" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{notification.productName}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" />
                          {notification.brandName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {notification.createdAt && (notification.createdAt as any).toDate
                            ? format((notification.createdAt as any).toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'Data não disponível'
                          }
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isPending ? (
                      <Badge variant="outline" className="border-purple-600 text-purple-700">
                        Aguardando Resposta
                      </Badge>
                    ) : metadata.adjustmentApproved ? (
                      <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">
                        ✓ Aprovado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="border-red-600 text-red-700 bg-red-50">
                        ✗ Recusado
                      </Badge>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                </div>
              </CardHeader>

              {/* Expandable Content */}
              {isExpanded && (
                <CardContent className="space-y-4 pt-0">
                  <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                    <p className="text-sm font-medium text-muted-foreground">
                      O comprador está solicitando um ajuste nas quantidades:
                    </p>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-3 bg-red-50 rounded-lg">
                        <p className="text-xs text-red-600 font-medium mb-1">Oferta Original</p>
                        <p className="text-sm font-semibold">{originalOfferedBoxes} caixas</p>
                        <p className="text-xs text-muted-foreground">{originalUnitsInPackaging} un/emb</p>
                      </div>
                      <div className="p-3 bg-green-50 rounded-lg">
                        <p className="text-xs text-green-600 font-medium mb-1">Quantidade Ajustada</p>
                        <p className="text-sm font-semibold">{adjustedBoxes} caixas</p>
                        <p className="text-xs text-muted-foreground">{adjustedUnitsInPackaging} un/emb</p>
                      </div>
                    </div>
                  </div>

                  {isPending ? (
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor={`reason-${notification.id}`} className="text-sm font-medium">
                          Motivo da recusa (opcional)
                        </Label>
                        <Textarea
                          id={`reason-${notification.id}`}
                          placeholder="Ex: Não consigo fornecer essa quantidade..."
                          value={rejectionReasons[notification.id] || ''}
                          onChange={(e) => setRejectionReasons(prev => ({
                            ...prev,
                            [notification.id]: e.target.value
                          }))}
                          className="mt-1"
                          rows={2}
                        />
                      </div>

                      <div className="flex items-center gap-3">
                        <Button
                          onClick={() => handleApprove(notification)}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Aceitar Ajuste
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => handleReject(notification)}
                          disabled={isProcessing}
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Recusar Ajuste
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className={`p-3 rounded-lg ${
                      metadata.adjustmentApproved
                        ? 'bg-green-50 border border-green-200'
                        : 'bg-red-50 border border-red-200'
                    }`}>
                      <p className={`text-sm font-medium ${
                        metadata.adjustmentApproved ? 'text-green-900' : 'text-red-900'
                      }`}>
                        {metadata.adjustmentApproved
                          ? 'Você aceitou este ajuste'
                          : 'Você recusou este ajuste'
                        }
                      </p>
                      {metadata.rejectionReason && (
                        <p className="text-sm text-red-700 mt-1">
                          Motivo: {metadata.rejectionReason}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Processado em {format((notification.readAt as any)?.toDate?.() || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
