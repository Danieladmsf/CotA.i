/**
 * useNewBrandModal Hook
 *
 * Manages new brand request modal logic for supplier quotation portal.
 * Handles form state, image upload, and brand request submission.
 */

import { useState } from 'react';
import { toast } from '@/hooks/use-toast';
import type { UnitOfMeasure, Quotation, Fornecedor as SupplierType } from '@/types';
import { formatPackaging } from '@/lib/quotation/utils';

interface NewBrandForm {
  brandName: string;
  packagingDescription: string;
  unitsInPackaging: number;
  unitWeight: number;
  totalPackagingPrice: number;
  imageFile: File | null;
}

interface NewBrandModalState {
  isOpen: boolean;
  productId: string;
  productName: string;
  productUnit: UnitOfMeasure | '';
}

interface UseNewBrandModalParams {
  quotation: Quotation | null;
  currentSupplierDetails: SupplierType | null;
  supplierId: string;
  sellerUser: any;
  speak: (message: string) => void;
  voiceMessages: any;
  checkAndBlockIfQuotationEnded: () => boolean;
  startNewBrandFlow: (productId: string) => void;
}

export function useNewBrandModal({
  quotation,
  currentSupplierDetails,
  supplierId,
  sellerUser,
  speak,
  voiceMessages,
  checkAndBlockIfQuotationEnded,
  startNewBrandFlow,
}: UseNewBrandModalParams) {
  // States
  const [newBrandModal, setNewBrandModal] = useState<NewBrandModalState>({
    isOpen: false,
    productId: '',
    productName: '',
    productUnit: ''
  });

  const [newBrandForm, setNewBrandForm] = useState<NewBrandForm>({
    brandName: '',
    packagingDescription: '',
    unitsInPackaging: 0,
    unitWeight: 0,
    totalPackagingPrice: 0,
    imageFile: null
  });

  const [isSubmittingNewBrand, setIsSubmittingNewBrand] = useState(false);

  // Open new brand modal
  const openNewBrandModal = (productId: string, productName: string, productUnit: UnitOfMeasure) => {
    // Verificação de segurança: bloquear se cotação encerrada
    if (checkAndBlockIfQuotationEnded()) return;

    // Usar fluxo guiado ao invés de modal
    startNewBrandFlow(productId);

    // Manter dados do modal para compatibilidade (mas não abrir modal)
    setNewBrandModal({
      isOpen: false, // Modal fechado, usando fluxo guiado
      productId,
      productName,
      productUnit
    });
    speak("Ok, vamos solicitar uma nova marca. Vou te guiar passo a passo para criar uma proposta. Sua sugestão será enviada para o comprador analisar.");
  };

  // Close new brand modal
  const closeNewBrandModal = () => {
    setNewBrandModal({
      isOpen: false,
      productId: '',
      productName: '',
      productUnit: '' as UnitOfMeasure | ''
    });
    setNewBrandForm({
      brandName: '',
      packagingDescription: '',
      unitsInPackaging: 0,
      unitWeight: 0,
      totalPackagingPrice: 0,
      imageFile: null
    });
  };

  // Handle form field change
  const handleNewBrandFormChange = (field: keyof typeof newBrandForm, value: any) => {
    setNewBrandForm(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Upload image to Vercel Blob
  const uploadImageToVercelBlob = async (file: File): Promise<string> => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      // Use filename as query parameter as expected by the API
      const filename = `brand-images/${Date.now()}-${file.name}`;
      const response = await fetch(`/api/upload?filename=${encodeURIComponent(filename)}`, {
        method: 'POST',
        body: file, // Send file directly, not FormData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Falha no upload da imagem');
      }

      const data = await response.json();
      return data.url;
    } catch (error: any) {
      throw new Error('Falha no upload da imagem: ' + error.message);
    }
  };

  // Submit new brand request
  const submitNewBrandRequest = async () => {
    if (!quotation || !currentSupplierDetails || !newBrandModal.productId) {
      toast({ title: "Erro", description: "Dados insuficientes para enviar solicitação.", variant: "destructive" });
      return;
    }

    if (!sellerUser?.uid) {
      toast({ title: "Erro de Autenticação", description: "Seu usuário não foi encontrado. Por favor, recarregue a página.", variant: "destructive" });
      return;
    }

    // For unit-based products (Unidade(s)), unitWeight is not required - default to 1
    const isUnitProduct = newBrandModal.productUnit === 'Unidade(s)';
    let unitWeight = newBrandForm.unitWeight;

    if (isUnitProduct && unitWeight <= 0) {
      unitWeight = 1; // Default to 1 for unit products
    }

    // Validate required fields
    if (newBrandForm.unitsInPackaging <= 0) {
      toast({ title: "Erro", description: "Preencha a quantidade de unidades na caixa.", variant: "destructive" });
      return;
    }

    if (newBrandForm.totalPackagingPrice <= 0) {
      toast({ title: "Erro", description: "Preencha o preço da caixa.", variant: "destructive" });
      return;
    }

    // For weight/volume products, unitWeight is required
    if (!isUnitProduct && unitWeight <= 0) {
      toast({ title: "Erro", description: "Preencha o peso/volume da embalagem.", variant: "destructive" });
      return;
    }

    setIsSubmittingNewBrand(true);

    try {
      let imageUrl = '';
      if (newBrandForm.imageFile) {
        try {
          imageUrl = await uploadImageToVercelBlob(newBrandForm.imageFile);
        } catch (error: any) {
          // Image upload failed, continuing without image
        }
      }

      // No modal de nova marca, unitsInPackaging representa "Total Un na Emb" (unidades por embalagem)
      // O preço é da embalagem completa, então calculamos: preço_embalagem / (unidades × peso_unitário)
      const unitsPerPackage = newBrandForm.unitsInPackaging; // "Total Un na Emb"
      const pricePerUnit = newBrandForm.totalPackagingPrice / (unitsPerPackage * unitWeight);

      const brandRequestData = {
        quotationId: quotation.id,
        productId: newBrandModal.productId,
        productName: newBrandModal.productName,
        supplierId: supplierId,
        supplierName: currentSupplierDetails.empresa,
        supplierInitials: currentSupplierDetails.vendedor.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase(),
        brandName: newBrandForm.brandName.trim(),
        packagingDescription: newBrandForm.packagingDescription.trim() || formatPackaging(newBrandForm.unitsInPackaging, unitWeight, newBrandModal.productUnit as UnitOfMeasure),
        unitsInPackaging: newBrandForm.unitsInPackaging,
        unitsPerPackage: newBrandForm.unitsInPackaging, // No modal, unitsInPackaging = unitsPerPackage
        unitWeight: unitWeight,
        totalPackagingPrice: newBrandForm.totalPackagingPrice,
        pricePerUnit: pricePerUnit,
        imageUrl: imageUrl,
        imageFileName: newBrandForm.imageFile?.name || '',
        buyerUserId: quotation.userId,
        sellerUserId: sellerUser?.uid || supplierId,
      };

      const response = await fetch('/api/brand-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(brandRequestData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Falha ao enviar solicitação');
      }

      const result = await response.json();

      // Check for notification error
      if (result.notificationError) {
        toast({
          title: "Solicitação Enviada com Aviso",
          description: `Marca enviada, mas notificação falhou: ${result.notificationError}`,
          variant: "default"
        });
      } else {
        toast({
          title: "Solicitação Enviada!",
          description: "Sua nova marca foi enviada para aprovação do comprador.",
          variant: "default"
        });
      }

      speak(voiceMessages.success.brandRequestSent);
      closeNewBrandModal();
    } catch (error: any) {
      toast({
        title: "Erro ao Enviar",
        description: error.message,
        variant: "destructive"
      });
      speak(voiceMessages.error.brandRequestFailed);
    } finally {
      setIsSubmittingNewBrand(false);
    }
  };

  return {
    // States
    newBrandModal,
    newBrandForm,
    isSubmittingNewBrand,

    // Handlers
    openNewBrandModal,
    closeNewBrandModal,
    handleNewBrandFormChange,
    uploadImageToVercelBlob,
    submitNewBrandRequest,
  };
}
