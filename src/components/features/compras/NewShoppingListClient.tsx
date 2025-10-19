"use client";

/**
 * NewShoppingListClient Component (REFATORADO)
 *
 * Componente principal para criação/edição de listas de compras.
 * Orquestra hooks e componentes especializados.
 *
 * Reduzido de 667 linhas para ~200 linhas (-70%)
 * - Lógica extraída para hooks customizados
 * - UI extraída para componentes especializados
 * - Utilitários movidos para /lib/utils
 */

import React, { useRef, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Input } from '@/components/ui/input';
import { CheckCircle, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';

// Custom hooks
import { useSuppliesData } from '@/hooks/shopping-list/useSuppliesData';
import { useSupplySelection } from '@/hooks/shopping-list/useSupplySelection';
import { useShoppingList } from '@/hooks/shopping-list/useShoppingList';

// Specialized components
import SupplySelector from './supply-selector/SupplySelector';
import ListItemsEditor from './list-editor/ListItemsEditor';

interface NewShoppingListClientProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onListSaved: (listId: string, date: Date) => void;
  hasActiveQuotation?: boolean;
  quotationStatus?: string | null;
  listId?: string | null; // ID específico da lista a carregar
}

export default function NewShoppingListClient({
  selectedDate,
  onDateChange,
  onListSaved,
  hasActiveQuotation,
  quotationStatus,
  listId,
}: NewShoppingListClientProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  // Log props received
  console.log('🎨 [NewShoppingListClient] Rendered with props:', {
    selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd HH:mm') : null,
    listId,
    hasActiveQuotation,
    quotationStatus
  });

  // ========== REFS ==========
  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // ========== LOCAL STATE (apenas UI) ==========
  const [lastAddedSupplyId, setLastAddedSupplyId] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<any | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');

  // Determinar se está em modo read-only
  const isReadOnly = quotationStatus === 'Fechada' || quotationStatus === 'Concluída';

  // ========== HOOKS CUSTOMIZADOS ==========

  // Hook 1: Carregar insumos e categorias
  const { allSupplies, categories, isLoading: loadingData } = useSuppliesData(
    user?.uid || null,
    (error) => toast({ title: "Erro", description: error, variant: "destructive" })
  );

  // Hook 2: Filtros de seleção
  const {
    filteredSupplies,
    activeTab,
    setActiveTab,
    searchTerm,
    setSearchTerm,
  } = useSupplySelection(allSupplies, categories);

  // Hook 3: Gerenciar lista de compras
  const {
    currentListItems,
    currentListId,
    currentMode,
    isLoading: loadingList,
    isSaving,
    pendingItemsCount,
    addSupply,
    updateItem,
    deleteItem,
    saveList,
  } = useShoppingList(
    selectedDate,
    user?.uid || null,
    categories,
    (message) => toast({
      title: "Sucesso!",
      description: message,
      variant: "default",
      action: <CheckCircle className="h-5 w-5 text-green-500" />
    }),
    (error) => toast({
      title: "Erro",
      description: error,
      variant: "destructive",
      duration: 9000
    }),
    listId // Passar o listId específico para o hook
  );

  // Log hook results

  // ========== HANDLERS ==========

  const handleAddSupply = (supply: any) => {
    if (isReadOnly) return;

    addSupply(supply);
    setLastAddedSupplyId(supply.id);
  };

  const handleSaveList = async () => {
    if (isReadOnly) return;

    const listId = await saveList();
    if (listId && pendingItemsCount > 0) {
      onListSaved(listId, selectedDate);
      setLastAddedSupplyId(null);
    }
  };

  const handleDeleteClick = (item: any) => {
    if (isReadOnly) return;

    if (item.quotationId) {
      // Item está em cotação - exigir confirmação
      setItemToDelete(item);
      setIsDeleteModalOpen(true);
    } else {
      // Sem cotação - deletar direto
      executeDeleteItem(item);
    }
  };

  const executeDeleteItem = async (item: any) => {
    await deleteItem(item);
    setItemToDelete(null);
    setIsDeleteModalOpen(false);
    setDeleteConfirmationText('');
  };

  const handleQuantityKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setLastAddedSupplyId(null);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  };

  // ========== EFFECTS ==========

  // Auto-focus no input de quantidade quando item é adicionado
  useEffect(() => {
    if (lastAddedSupplyId && quantityInputRefs.current[lastAddedSupplyId]) {
      const inputElement = quantityInputRefs.current[lastAddedSupplyId];
      inputElement?.focus();
      inputElement?.select();

      // Scroll para o card
      const itemCard = document.getElementById(`item-card-${lastAddedSupplyId}`);
      itemCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [lastAddedSupplyId]);

  // ========== RENDER ==========

  return (
    <div className="space-y-6">
      {/* Read-only warning banner */}
      {isReadOnly && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border-2 border-amber-300 rounded-lg">
          <div className="flex-1">
            <h3 className="font-bold text-amber-900 mb-1">Cotação Encerrada</h3>
            <p className="text-sm text-amber-800">
              Esta lista está em modo <strong>somente leitura</strong> porque pertence a uma cotação encerrada ({quotationStatus}).
            </p>
            <p className="text-xs text-amber-700 mt-2">
              Para criar uma nova lista: selecione uma <strong>data diferente</strong> no navegador acima ou clique em <strong>&quot;Limpar Filtro&quot;</strong>.
            </p>
          </div>
        </div>
      )}

      {/* Header com título e botão salvar */}
      <div className="flex flex-col sm:flex-row items-center justify-between pb-4 border-b gap-4">
        <h1 className="text-xl md:text-2xl font-bold text-center order-first sm:order-none">
          {isReadOnly
            ? `Visualizando Lista (${quotationStatus})`
            : currentMode === 'edit'
            ? `Editando Lista`
            : `Nova Lista`}
        </h1>

        {!isReadOnly && (
          <Button
            onClick={handleSaveList}
            disabled={isSaving || loadingData || loadingList || pendingItemsCount === 0}
            className="min-w-[160px] w-full sm:w-auto"
          >
            {isSaving ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Save className="mr-2 h-5 w-5" />
            )}
            {currentMode === 'edit' ? 'Salvar e Cotar' : 'Salvar e Avançar'} ({pendingItemsCount})
          </Button>
        )}
      </div>

      {/* Grid com 2 cards principais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: Seletor de Insumos (esquerda) */}
        <SupplySelector
          supplies={filteredSupplies}
          categories={categories}
          selectedDate={selectedDate}
          isLoading={loadingData}
          isReadOnly={isReadOnly}
          currentListItemIds={currentListItems.map(item => item.supplyId)}
          activeTab={activeTab}
          searchTerm={searchTerm}
          onTabChange={setActiveTab}
          onSearchChange={setSearchTerm}
          onSupplyAdd={handleAddSupply}
          searchInputRef={searchInputRef}
        />

        {/* Card 2: Editor de Itens (direita) */}
        <ListItemsEditor
          items={currentListItems}
          selectedDate={selectedDate}
          isLoading={loadingList}
          isReadOnly={isReadOnly}
          hasActiveQuotation={hasActiveQuotation}
          highlightedItemId={lastAddedSupplyId}
          onUpdate={updateItem}
          onDelete={handleDeleteClick}
          onItemFocus={(supplyId) => setLastAddedSupplyId(supplyId)}
          onQuantityKeyDown={handleQuantityKeyDown}
          quantityInputRefs={quantityInputRefs}
        />
      </div>

      {/* Modal de confirmação de exclusão */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
            <DialogDescription>
              Você está prestes a remover o item &quot;{itemToDelete?.name}&quot; da lista.
              {itemToDelete?.quotationId && (
                <> Se este item já faz parte de uma cotação, ele será removido da cotação também.</>
              )}
              <br /><br />
              Para confirmar, digite <strong>&quot;DELETE&quot;</strong> no campo abaixo.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Digite DELETE para confirmar"
            value={deleteConfirmationText}
            onChange={(e) => setDeleteConfirmationText(e.target.value)}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={deleteConfirmationText !== 'DELETE'}
              onClick={() => itemToDelete && executeDeleteItem(itemToDelete)}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
