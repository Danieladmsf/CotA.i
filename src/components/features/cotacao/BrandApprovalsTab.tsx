'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion, getDoc, addDoc, Timestamp, getDocs } from 'firebase/firestore';
import { CheckCircle, XCircle, AlertCircle, Package, Calendar, User, DollarSign, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Image from 'next/image';
import { notifySupplierBrandApproved, notifySupplierBrandRejected } from '@/actions/notificationService';
import type { PendingBrandRequest } from '@/types';

export default function BrandApprovalsTab({ quotationId }: { quotationId: string }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [allRequests, setAllRequests] = useState<PendingBrandRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');

  useEffect(() => {
    if (!user?.uid || !quotationId) return;

    // Query by quotationId only (buyerUserId may not exist in old docs)
    const allRequestsQuery = query(
      collection(db, 'pending_brand_requests'),
      where('quotationId', '==', quotationId)
    );

    const unsubscribe = onSnapshot(
      allRequestsQuery,
      (snapshot) => {
        const requests = snapshot.docs.map(doc => {
          const data = doc.data();

          // Backward compatibility: old docs use 'requestedBy' instead of 'buyerUserId'
          const buyerUserId = data.buyerUserId || data.requestedBy;
          const createdAt = data.createdAt || data.requestedAt;

          return {
            id: doc.id,
            ...data,
            buyerUserId, // Override with backward compatible value
            createdAt    // Override with backward compatible value
          } as PendingBrandRequest;
        });

        requests.sort((a, b) => {
          const aTime = (a.createdAt as any)?.toDate?.() || new Date(0);
          const bTime = (b.createdAt as any)?.toDate?.() || new Date(0);
          return bTime.getTime() - aTime.getTime();
        });

        setAllRequests(requests);
        setIsLoading(false);
      },
      (error) => {
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user?.uid, quotationId]);

  // Filter requests based on status filter
  const filteredRequests = statusFilter === 'all'
    ? allRequests
    : allRequests.filter(req => req.status === statusFilter);

  const pendingCount = allRequests.filter(req => req.status === 'pending').length;
  const approvedCount = allRequests.filter(req => req.status === 'approved').length;
  const rejectedCount = allRequests.filter(req => req.status === 'rejected').length;

  const toggleCardExpansion = (requestId: string) => {
    setExpandedCards(prev => {
      const newSet = new Set(prev);
      if (newSet.has(requestId)) {
        newSet.delete(requestId);
      } else {
        newSet.add(requestId);
      }
      return newSet;
    });
  };

  const handleApproval = async (request: PendingBrandRequest, approved: boolean) => {
    if (!request.id) return;

    console.log('🟢 [handleApproval] Iniciando aprovação/rejeição', { requestId: request.id, approved });
    setProcessingIds(prev => new Set(prev).add(request.id!));

    try {
      if (approved) {
        console.log('✅ [handleApproval] Aprovando marca...');
        // 1. Update the pending request status
        const requestRef = doc(db, 'pending_brand_requests', request.id);
        console.log('📝 [handleApproval] Atualizando status para approved...');
        await updateDoc(requestRef, {
          status: 'approved',
          updatedAt: Timestamp.now()
        });
        console.log('✅ [handleApproval] Status atualizado com sucesso');

        // 2. Add brand to supplies collection (handle both string and array formats)
        try {
          console.log('📦 [handleApproval] Adicionando marca às coleções supplies...');
          // First, check shopping_list_items to get the correct supplyId
          const shoppingListRef = doc(db, 'shopping_list_items', request.productId);
          const shoppingListSnap = await getDoc(shoppingListRef);
          
          let actualSupplyId = request.productId; // Default fallback
          
          if (shoppingListSnap.exists()) {
            const shoppingListData = shoppingListSnap.data();
            if (shoppingListData.supplyId) {
              actualSupplyId = shoppingListData.supplyId;
            }
          }
          
          const suppliesRef = doc(db, 'supplies', actualSupplyId);
          const suppliesSnap = await getDoc(suppliesRef);

          if (suppliesSnap.exists()) {
            const suppliesData = suppliesSnap.data();
            const currentBrands = suppliesData.preferredBrands;

            let updatedBrands;
            if (typeof currentBrands === 'string') {
              const brandsArray = currentBrands.split(',').map(b => b.trim()).filter(b => b.length > 0);
              if (!brandsArray.includes(request.brandName)) {
                brandsArray.push(request.brandName);
              }
              updatedBrands = brandsArray; 
            } else if (Array.isArray(currentBrands)) {
              updatedBrands = [...currentBrands, request.brandName];
            } else {
              updatedBrands = [request.brandName];
            }
            
            // Remove duplicates
            updatedBrands = [...new Set(updatedBrands)];

            await updateDoc(suppliesRef, {
              preferredBrands: updatedBrands,
              updatedAt: Timestamp.now()
            });
          }
        } catch (error) {
          console.error('❌ [handleApproval] Erro ao atualizar supplies:', error);
        }

        // 3. Add brand to shopping_list_items collection
        try {
          console.log('📝 [handleApproval] Adicionando marca ao shopping_list_items...');
          const shoppingListRef = doc(db, 'shopping_list_items', request.productId);
          const shoppingListSnap = await getDoc(shoppingListRef);
          
          if (shoppingListSnap.exists()) {
            const shoppingListData = shoppingListSnap.data();
            const currentBrands = shoppingListData.preferredBrands;
            
            let updatedBrands;
            if (typeof currentBrands === 'string') {
              const brandsArray = currentBrands.split(',').map(b => b.trim()).filter(b => b.length > 0);
              if (!brandsArray.includes(request.brandName)) {
                brandsArray.push(request.brandName);
              }
              updatedBrands = brandsArray;
            } else if (Array.isArray(currentBrands)) {
              updatedBrands = [...currentBrands, request.brandName];
            } else {
              updatedBrands = [request.brandName];
            }

            // Remove duplicates
            updatedBrands = [...new Set(updatedBrands)];

            await updateDoc(shoppingListRef, {
              preferredBrands: updatedBrands,
              updatedAt: Timestamp.now()
            });
          }
        } catch (error) {
          console.error('❌ [handleApproval] Erro ao atualizar shopping_list_items:', error);
        }

        // 4. Create the actual offer now that the brand is approved
        try {
          console.log('💰 [handleApproval] Criando oferta automaticamente...');
          const offersCollectionRef = collection(db, 'quotations', request.quotationId, 'products', request.productId, 'offers');
          
          const offerPayload = {
            quotationId: request.quotationId, // ✅ CRITICAL: Required for collectionGroup query filter
            productId: request.productId,
            supplierId: request.supplierId,
            supplierName: request.supplierName,
            supplierInitials: request.supplierInitials,
            brandOffered: request.brandName,
            packagingDescription: request.packagingDescription,
            unitsInPackaging: 1, // Default to 1 since brand request doesn't specify package quantity
            unitsPerPackage: request.unitsInPackaging, // In brand request, this field contains units per package
            unitWeight: request.unitWeight,
            totalPackagingPrice: request.totalPackagingPrice,
            pricePerUnit: request.pricePerUnit,
            updatedAt: Timestamp.now(),
          };

          console.log('💰 [handleApproval] Payload da oferta:', offerPayload);
          const newOfferRef = await addDoc(offersCollectionRef, offerPayload);
          console.log('✅ [handleApproval] Oferta criada com sucesso! ID:', newOfferRef.id);
          console.log('✅ [handleApproval] Path:', `quotations/${request.quotationId}/products/${request.productId}/offers`);

        } catch (error) {
          console.error('❌ [handleApproval] Erro ao criar oferta:', error);
          // We don't re-throw, as the main approval process was successful
          toast({
            title: "Erro ao Criar Oferta",
            description: "A marca foi aprovada, mas houve um erro ao criar a oferta automaticamente. O fornecedor talvez precise reenviar.",
            variant: "destructive",
          });
        }

        toast({
          title: "Marca Aprovada!",
          description: `A marca "${request.brandName}" foi aprovada e adicionada às marcas preferenciais.`,
          variant: "default"
        });
      } else {
        console.log('❌ [handleApproval] Rejeitando marca...');
        // Just reject the request
        const requestRef = doc(db, 'pending_brand_requests', request.id);
        await updateDoc(requestRef, {
          status: 'rejected',
          rejectionReason: 'Rejeitada pelo comprador',
          updatedAt: Timestamp.now()
        });
        console.log('✅ [handleApproval] Marca rejeitada com sucesso');

        toast({
          title: "Marca Rejeitada",
          description: `A proposta da marca "${request.brandName}" foi rejeitada.`,
          variant: "destructive"
        });
      }

      // 5. Create notification for the supplier using server-side function
      try {
        console.log('🔔 [handleApproval] Criando notificação para o fornecedor...');

        // Fetch product name for a more descriptive message
        let productNameForNotif = request.productName || 'Produto desconhecido';
        if (!request.productName) {
            try {
                const productDoc = await getDoc(doc(db, 'shopping_list_items', request.productId));
                if (productDoc.exists()) {
                    productNameForNotif = productDoc.data().name || productNameForNotif;
                }
            } catch (e) {
              console.warn('❌ [handleApproval] Failed to fetch product name:', e);
            }
        }

        // Call the appropriate server-side notification function
        const notificationResult = approved
          ? await notifySupplierBrandApproved({
              targetSupplierId: request.supplierId,
              quotationId: request.quotationId,
              productName: productNameForNotif,
              brandName: request.brandName
            })
          : await notifySupplierBrandRejected({
              targetSupplierId: request.supplierId,
              quotationId: request.quotationId,
              productName: productNameForNotif,
              brandName: request.brandName,
              rejectionReason: undefined // Could be enhanced in the future to ask for rejection reason
            });

        if (notificationResult.success) {
          console.log('✅ [handleApproval] Notificação criada com sucesso (server-side)');
        } else {
          console.error('❌ [handleApproval] Erro ao criar notificação (server-side):', notificationResult.error);
        }

      } catch (notificationError) {
        console.error('❌ [handleApproval] Erro ao criar notificação:', notificationError);
        // Non-critical, so we don't show a toast to the buyer for this
      }

      // Mark the associated notification as read, regardless of outcome
      try {
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('entityId', '==', request.id),
          where('type', '==', 'brand_approval_pending')
        );
        const notificationSnapshot = await getDocs(notificationsQuery);
        if (!notificationSnapshot.empty) {
          const notificationDoc = notificationSnapshot.docs[0];
          if (!notificationDoc.data().isRead) {
            await updateDoc(doc(db, 'notifications', notificationDoc.id), {
              isRead: true,
              readAt: Timestamp.now()
            });
          }
        }
      } catch (notificationError) {
        // Do not re-throw, as the main action (approval/rejection) was successful
      }

    } catch (error: any) {
      console.error('🔴 [handleApproval] ERRO PRINCIPAL:', error);
      console.error('🔴 [handleApproval] Error message:', error?.message);
      console.error('🔴 [handleApproval] Error code:', error?.code);
      console.error('🔴 [handleApproval] Error stack:', error?.stack);
      toast({
        title: "Erro",
        description: `Erro ao processar a solicitação: ${error?.message || 'Desconhecido'}. Tente novamente.`,
        variant: "destructive"
      });
    } finally {
      setProcessingIds(prev => {
        const newSet = new Set(prev);
        newSet.delete(request.id!);
        return newSet;
      });
    }
  };

  // Diagnostic function to analyze data relationships
  const runDiagnostic = async () => {
    if (allRequests.length === 0) {
      toast({
        title: "Nenhuma Solicitação Pendente",
        description: "Não há solicitações pendentes para diagnosticar.",
        variant: "default"
      });
      return;
    }

    const request = allRequests[0]; // Use first request

    try {
      // 1. Check shopping_list_items
      const shoppingListRef = doc(db, 'shopping_list_items', request.productId);
      const shoppingListSnap = await getDoc(shoppingListRef);

      if (shoppingListSnap.exists()) {
        const data = shoppingListSnap.data();

        // 2. Check supplies using supplyId
        if (data.supplyId) {
          const suppliesRef = doc(db, 'supplies', data.supplyId);
          const suppliesSnap = await getDoc(suppliesRef);

          if (suppliesSnap.exists()) {
            const suppliesData = suppliesSnap.data();
          }
        }

        // 3. Also check supplies using productId directly
        const suppliesDirectRef = doc(db, 'supplies', request.productId);
        const suppliesDirectSnap = await getDoc(suppliesDirectRef);

        if (suppliesDirectSnap.exists()) {
          const suppliesDirectData = suppliesDirectSnap.data();
        }

      }

      toast({
        title: "Diagnóstico Completo",
        description: "Verifique o console do navegador para detalhes completos.",
        variant: "default"
      });

    } catch (error) {
      toast({
        title: "Erro no Diagnóstico",
        description: "Erro ao executar diagnóstico. Verifique o console.",
        variant: "destructive"
      });
    }
  };

  // Function to fix the Soya brand data specifically
  const fixSoyaBrandData = async () => {
    try {
      // Find the supply with name "Óleo de gergelim"
      const suppliesRef = doc(db, 'supplies', '3ho07m0dfYllf0SPqkso');
      const suppliesSnap = await getDoc(suppliesRef);

      if (suppliesSnap.exists()) {
        const data = suppliesSnap.data();
        const currentBrands = data.preferredBrands;

        if (typeof currentBrands === 'string' && !currentBrands.includes('Soya')) {
          const updatedBrands = currentBrands + ', Soya';

          await updateDoc(suppliesRef, {
            preferredBrands: updatedBrands,
            updatedAt: Timestamp.now()
          });

          toast({
            title: "Dados Corrigidos!",
            description: "A marca Soya foi adicionada ao supplies com sucesso.",
            variant: "default"
          });
        } else {
          toast({
            title: "Já Atualizado",
            description: "A marca Soya já existe no supplies.",
            variant: "default"
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao Corrigir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  // Function to diagnose product ID mapping
  const diagnoseProductMapping = async () => {
    try {
      // Check the latest Soya request
      const soyaProductId = "YFESxRQl0xvIXZcUNaCM";

      // Check supplies collection
      const suppliesRef = doc(db, 'supplies', soyaProductId);
      const suppliesSnap = await getDoc(suppliesRef);

      if (suppliesSnap.exists()) {
        const suppliesData = suppliesSnap.data();
      }

      // Check shopping_list_items collection
      const shoppingListRef = doc(db, 'shopping_list_items', soyaProductId);
      const shoppingListSnap = await getDoc(shoppingListRef);

      if (shoppingListSnap.exists()) {
        const shoppingListData = shoppingListSnap.data();
      }

      // Check if supplyId matches
      if (shoppingListSnap.exists()) {
        const shoppingListData = shoppingListSnap.data();
        const supplyId = shoppingListData.supplyId;

        if (supplyId && supplyId !== soyaProductId) {
          // Check if supplies document exists with correct ID
          const correctSuppliesRef = doc(db, 'supplies', supplyId);
          const correctSuppliesSnap = await getDoc(correctSuppliesRef);

          if (correctSuppliesSnap.exists()) {
            const correctSuppliesData = correctSuppliesSnap.data();
          }
        }
      }

      toast({
        title: "Diagnóstico Concluído",
        description: "Verifique o console para detalhes.",
        variant: "default"
      });
    } catch (error: any) {
      toast({
        title: "Erro no Diagnóstico",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Function to fix existing brand data
  const fixExistingBrandData = async () => {
    try {
      // Directly fix the Soya brand data for productId: "Dlz6iCbA7z2zh1ow5TlP"
      const productId = "Dlz6iCbA7z2zh1ow5TlP"; // Óleo de gergelim
      const brandToAdd = "Soya";

      const suppliesRef = doc(db, 'supplies', productId);
      const suppliesSnap = await getDoc(suppliesRef);

      if (suppliesSnap.exists()) {
        const suppliesData = suppliesSnap.data();
        const currentBrands = suppliesData.preferredBrands;

        if (typeof currentBrands === 'string') {
          const brandsArray = currentBrands.split(',').map(b => b.trim()).filter(b => b.length > 0);
          if (!brandsArray.includes(brandToAdd)) {
            brandsArray.push(brandToAdd);
            const updatedBrands = brandsArray.join(', ');

            await updateDoc(suppliesRef, {
              preferredBrands: updatedBrands,
              updatedAt: Timestamp.now()
            });

            toast({
              title: "Dados Corrigidos!",
              description: `A marca '${brandToAdd}' foi adicionada corretamente ao supplies.`,
              variant: "default"
            });
          } else {
            toast({
              title: "Já Atualizado",
              description: `A marca '${brandToAdd}' já existe no supplies.`,
              variant: "default"
            });
          }
        }
      }
    } catch (error: any) {
      toast({
        title: "Erro ao Corrigir",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Carregando aprovações...</span>
      </div>
    );
  }

  if (allRequests.length === 0) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">Nenhuma solicitação de marca</h3>
        <p className="text-muted-foreground">
          Não há solicitações de novas marcas registradas ainda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Histórico de Solicitações de Marcas</h2>
            <p className="text-muted-foreground">
              {allRequests.length} solicitação(ões) no total | {pendingCount} aguardando aprovação
            </p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 border-b">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              statusFilter === 'all'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Todas
            <Badge variant="secondary" className="ml-2">
              {allRequests.length}
            </Badge>
          </button>
          <button
            onClick={() => setStatusFilter('pending')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              statusFilter === 'pending'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Pendentes
            <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">
              {pendingCount}
            </Badge>
          </button>
          <button
            onClick={() => setStatusFilter('approved')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              statusFilter === 'approved'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Aprovadas
            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-800">
              {approvedCount}
            </Badge>
          </button>
          <button
            onClick={() => setStatusFilter('rejected')}
            className={`px-4 py-2 font-medium transition-colors relative ${
              statusFilter === 'rejected'
                ? 'text-primary border-b-2 border-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Rejeitadas
            <Badge variant="secondary" className="ml-2 bg-red-100 text-red-800">
              {rejectedCount}
            </Badge>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        {filteredRequests.map((request) => {
          const isProcessing = processingIds.has(request.id!);
          const isExpanded = expandedCards.has(request.id!);
          const isPending = request.status === 'pending';
          const isApproved = request.status === 'approved';
          const isRejected = request.status === 'rejected';

          const borderColor = isPending ? 'border-l-orange-500' : isApproved ? 'border-l-green-500' : 'border-l-red-500';

          return (
            <Card key={request.id} className={`border-l-4 ${borderColor} transition-all duration-200`}>
              {/* Compact Header - Always Visible */}
              <CardHeader 
                className="cursor-pointer hover:bg-muted/30 transition-colors pb-4"
                onClick={() => toggleCardExpansion(request.id!)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      {request.imageUrl ? (
                        <Image
                          src={request.imageUrl}
                          alt={request.brandName}
                          width={50}
                          height={50}
                          className="rounded-lg object-cover border"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                          <Package className="h-6 w-6 text-orange-600" />
                        </div>
                      )}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{request.brandName}</CardTitle>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          Proposta de: {request.supplierName}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {request.createdAt && (request.createdAt as any).toDate
                            ? format((request.createdAt as any).toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : (request as any).requestedAt && (request as any).requestedAt.toDate
                            ? format((request as any).requestedAt.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                            : 'Data não disponível'
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {isPending && (
                      <Badge variant="outline" className="border-orange-600 text-orange-700">
                        Aguardando Aprovação
                      </Badge>
                    )}
                    {isApproved && (
                      <Badge variant="outline" className="border-green-600 text-green-700 bg-green-50">
                        ✓ Aprovada
                      </Badge>
                    )}
                    {isRejected && (
                      <Badge variant="outline" className="border-red-600 text-red-700 bg-red-50">
                        ✗ Rejeitada
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/30 rounded-lg">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Embalagem</p>
                      <p className="font-semibold">{request.packagingDescription}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Unidades</p>
                      <p className="font-semibold">{request.unitsInPackaging} un</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Preço por Unidade</p>
                      <p className="font-semibold text-lg flex items-center gap-1">
                        <DollarSign className="h-4 w-4 text-green-600" />
                        {formatCurrency(request.pricePerUnit)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="bg-orange-100 text-orange-800">
                          {request.supplierInitials}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{request.supplierName}</p>
                        <p className="text-xs text-muted-foreground">Fornecedor</p>
                      </div>
                    </div>

                    {isPending ? (
                      <div className="flex items-center gap-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproval(request, false);
                          }}
                          disabled={isProcessing}
                          className="border-red-200 text-red-700 hover:bg-red-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <XCircle className="h-4 w-4 mr-2" />
                          )}
                          Rejeitar
                        </Button>
                        <Button
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleApproval(request, true);
                          }}
                          disabled={isProcessing}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          {isProcessing ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <CheckCircle className="h-4 w-4 mr-2" />
                          )}
                          Aprovar
                        </Button>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        {isApproved && `Aprovada em ${format((request.updatedAt as any)?.toDate?.() || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                        {isRejected && `Rejeitada em ${format((request.updatedAt as any)?.toDate?.() || new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`}
                      </div>
                    )}
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