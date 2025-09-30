import { useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { FIREBASE_COLLECTIONS } from '@/lib/constants/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Quotation } from '@/types';

interface SupplierOrder {
  supplierId: string;
  supplierName: string;
  supplierFotoUrl?: string;
  supplierInitials: string;
  items: {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    brand: string;
    pricePerUnit: number;
    totalPrice: number;
  }[];
  totalValue: number;
}

interface UseSupplierNotificationProps {
  quotation: Quotation;
  supplierOrders: SupplierOrder[];
  suppliers: Map<string, any>; // Map com dados completos dos fornecedores
}

export function useSupplierNotification({
  quotation,
  supplierOrders,
  suppliers,
}: UseSupplierNotificationProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isSending, setIsSending] = useState(false);

  const sendToSuppliers = async (selectedSupplierIds: Set<string>) => {
    if (selectedSupplierIds.size === 0) {
      toast({
        title: "Nenhum fornecedor selecionado",
        description: "Selecione pelo menos um fornecedor para enviar.",
        variant: "destructive",
      });
      return;
    }

    if (!user?.uid) {
      toast({
        title: "Usuário não autenticado",
        description: "Faça login para enviar pedidos.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);

    try {
      // Filtrar pedidos dos fornecedores selecionados
      const ordersToSend = supplierOrders.filter(order =>
        selectedSupplierIds.has(order.supplierId)
      );

      const deadlineDate = quotation.deadline?.toDate ? quotation.deadline.toDate() : new Date();
      const quotationDate = format(deadlineDate, "dd/MM/yyyy", { locale: ptBR });

      let successCount = 0;
      let failedSuppliers: string[] = [];

      // Enviar mensagem para cada fornecedor
      for (const order of ordersToSend) {
        try {
          const supplier = suppliers.get(order.supplierId);

          if (!supplier?.whatsapp) {
            console.warn(`⚠️ Fornecedor ${order.supplierName} não tem WhatsApp cadastrado`);
            failedSuppliers.push(order.supplierName);
            continue;
          }

          // Formatar lista de produtos
          const itemsList = order.items.map((item, idx) =>
            `${idx + 1}. *${item.productName}*\n   Marca: ${item.brand}\n   Qtd: ${item.quantity} ${item.unit}\n   Preço: R$ ${item.pricePerUnit.toFixed(2)}\n   Total: R$ ${item.totalPrice.toFixed(2)}`
          ).join('\n\n');

          // Montar mensagem
          const message = `🛒 *PEDIDO DE COMPRA*\n\n` +
            `Olá *${order.supplierName}*,\n\n` +
            `Você foi selecionado para fornecer os seguintes itens da cotação de ${quotationDate}:\n\n` +
            `${itemsList}\n\n` +
            `━━━━━━━━━━━━━━━━━━━\n` +
            `*TOTAL: R$ ${order.totalValue.toFixed(2)}*\n` +
            `━━━━━━━━━━━━━━━━━━━\n\n` +
            `Por favor, confirme o recebimento deste pedido e nos informe sobre o prazo de entrega.\n\n` +
            `Agradecemos sua parceria! 🤝`;

          // Adicionar à fila do WhatsApp
          await addDoc(collection(db, FIREBASE_COLLECTIONS.WHATSAPP_QUEUE), {
            phoneNumber: supplier.whatsapp,
            message: message,
            supplierName: order.supplierName,
            isOutgoing: true,
            status: 'pending',
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          successCount++;
          console.log(`✅ Mensagem adicionada à fila para ${order.supplierName}`);
        } catch (error) {
          console.error(`❌ Erro ao enviar para ${order.supplierName}:`, error);
          failedSuppliers.push(order.supplierName);
        }
      }

      if (successCount > 0) {
        toast({
          title: "Pedidos enviados com sucesso!",
          description: `${successCount} fornecedor(es) receberão o pedido via WhatsApp.`,
        });
      }

      if (failedSuppliers.length > 0) {
        toast({
          title: "Alguns pedidos não foram enviados",
          description: `Fornecedores sem WhatsApp: ${failedSuppliers.join(', ')}`,
          variant: "destructive",
        });
      }

      console.log('📤 [Send to Suppliers] Resumo:', {
        quotationId: quotation.id,
        success: successCount,
        failed: failedSuppliers.length,
        failedSuppliers,
      });

      return successCount > 0;
    } catch (error) {
      console.error('❌ [Send to Suppliers] Erro:', error);
      toast({
        title: "Erro ao enviar pedidos",
        description: "Não foi possível enviar os pedidos. Tente novamente.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const sendViaWhatsApp = async (selectedSupplierIds: Set<string>) => {
    // TODO: Implementar envio via WhatsApp
    toast({
      title: "WhatsApp",
      description: "Funcionalidade em desenvolvimento",
    });
  };

  const sendViaEmail = async (selectedSupplierIds: Set<string>) => {
    // TODO: Implementar envio via Email
    toast({
      title: "Email",
      description: "Funcionalidade em desenvolvimento",
    });
  };

  return {
    sendToSuppliers,
    sendViaWhatsApp,
    sendViaEmail,
    isSending,
  };
}
