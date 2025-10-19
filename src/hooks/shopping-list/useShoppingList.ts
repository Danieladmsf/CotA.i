/**
 * useShoppingList Hook
 *
 * Gerencia estado e operações da lista de compras.
 * Responsável por CRUD de itens, salvamento no Firestore e sincronização.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  getDocs,
  writeBatch,
  query,
  where,
  Timestamp,
  doc,
  deleteDoc,
  serverTimestamp,
  orderBy as firestoreOrderBy
} from 'firebase/firestore';
import { db } from '@/lib/config/firebase';
import { startOfDay, endOfDay, isValid as isValidDate } from 'date-fns';
import type { Supply, ShoppingListItem, UnitOfMeasure, SupplyCategory } from '@/types';

const SHOPPING_LIST_ITEMS_COLLECTION = 'shopping_list_items';
const DEFAULT_IMPORT_CATEGORY_NAME = "Geral";

interface NewListItem {
  id?: string;
  listId?: string;
  supplyId: string;
  name: string;
  quantity: number | string;
  unit: UnitOfMeasure;
  preferredBrands?: string;
  notes?: string;
  status: 'Pendente' | 'Cotado' | 'Comprado' | 'Recebido' | 'Cancelado' | 'Encerrado';
  deliveryDate?: Timestamp;
  hasSpecificDate?: boolean;
  quotationId?: string;
  categoryId?: string;
}

interface UseShoppingListResult {
  currentListItems: NewListItem[];
  currentListId: string | null;
  currentMode: 'new' | 'edit';
  isLoading: boolean;
  isSaving: boolean;
  pendingItemsCount: number;

  // Actions
  addSupply: (supply: Supply) => void;
  updateItem: (supplyId: string, field: keyof NewListItem, value: any) => void;
  deleteItem: (item: NewListItem) => Promise<void>;
  saveList: () => Promise<string | null>;
  refreshList: () => Promise<void>;
}

/**
 * Hook principal para gerenciar lista de compras
 *
 * @param selectedDate - Data selecionada para a lista
 * @param userId - ID do usuário autenticado
 * @param categories - Categorias disponíveis
 * @param onSuccess - Callback de sucesso no salvamento
 * @param onError - Callback de erro
 * @param specificListId - (Opcional) ID específico da lista a carregar. Se fornecido, ignora a busca por data e carrega apenas esta lista.
 * @returns Estado e ações da lista
 */
export function useShoppingList(
  selectedDate: Date | undefined,
  userId: string | null,
  categories: SupplyCategory[],
  onSuccess?: (message: string) => void,
  onError?: (message: string) => void,
  specificListId?: string | null
): UseShoppingListResult {
  const [currentListItems, setCurrentListItems] = useState<NewListItem[]>([]);
  const [originalListItems, setOriginalListItems] = useState<NewListItem[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'new' | 'edit'>('new');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Buscar lista específica por listId
  const fetchSpecificList = useCallback(async (listId: string) => {

    if (!userId) {
      setIsLoading(false);
      setCurrentListItems([]);
      return;
    }

    setIsLoading(true);
    setCurrentListItems([]);
    setOriginalListItems([]);
    setCurrentListId(null);
    setCurrentMode('new');

    try {
      // Buscar itens específicos do listId
      const specificListQuery = query(
        collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
        where("userId", "==", userId),
        where("listId", "==", listId)
      );

      const snapshot = await getDocs(specificListQuery);

      if (snapshot.docs.length > 0) {
        const listItems = snapshot.docs.map(docSnap => ({
          id: docSnap.id,
          ...docSnap.data()
        } as ShoppingListItem));


        setCurrentMode('edit');
        setCurrentListId(listId);

        const fetchedItems = listItems.map(item => ({
          id: item.id,
          listId: item.listId,
          supplyId: item.supplyId,
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
          preferredBrands: item.preferredBrands || '',
          notes: item.notes || '',
          status: item.status,
          deliveryDate: item.hasSpecificDate ? item.deliveryDate : undefined,
          hasSpecificDate: item.hasSpecificDate,
          quotationId: item.quotationId,
          categoryId: item.categoryId,
        } as NewListItem));


        setCurrentListItems(fetchedItems);
        setOriginalListItems(fetchedItems);
      } else {
        setCurrentMode('new');
      }

    } catch (error: any) {
      console.error("Error fetching specific list:", error);
      if (onError) {
        onError(`Não foi possível carregar a lista: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Buscar lista existente para a data selecionada
  const fetchExistingItemsForDate = useCallback(async (date: Date) => {

    if (!userId) {
      setIsLoading(false);
      setCurrentListItems([]);
      return;
    }

    setIsLoading(true);
    setCurrentListItems([]);
    setOriginalListItems([]);
    setCurrentListId(null);
    setCurrentMode('new');

    try {
      const startOfSelectedDay = startOfDay(date);
      const endOfSelectedDay = endOfDay(date);


      // Buscar todos os itens do dia
      const allItemsForDayQuery = query(
        collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
        where("userId", "==", userId),
        where("listDate", ">=", Timestamp.fromDate(startOfSelectedDay)),
        where("listDate", "<=", Timestamp.fromDate(endOfSelectedDay)),
        firestoreOrderBy("listDate", "desc")
      );

      const snapshot = await getDocs(allItemsForDayQuery);

      const allItems = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as ShoppingListItem));

      // Agrupar por listId
      const lists = allItems.reduce((acc, item) => {
        const listId = item.listId || 'unassigned';
        if (!acc[listId]) {
          acc[listId] = [];
        }
        acc[listId].push(item);
        return acc;
      }, {} as Record<string, ShoppingListItem[]>);

      // Encontrar a lista mais recente
      const sortedListIds = Object.keys(lists).sort((a, b) => parseInt(b) - parseInt(a));


      if (sortedListIds.length > 0) {
        const loadedListId = sortedListIds[0];
        const listToLoad = lists[loadedListId];


        setCurrentMode('edit');
        setCurrentListId(loadedListId);

        const fetchedItems = listToLoad
          .map(item => ({
            id: item.id,
            listId: item.listId,
            supplyId: item.supplyId,
            name: item.name,
            quantity: item.quantity,
            unit: item.unit,
            preferredBrands: item.preferredBrands || '',
            notes: item.notes || '',
            status: item.status,
            deliveryDate: item.hasSpecificDate ? item.deliveryDate : undefined,
            hasSpecificDate: item.hasSpecificDate,
            quotationId: item.quotationId,
            categoryId: item.categoryId,
          } as NewListItem));
          // Não filtrar por status "Encerrado" - queremos ver histórico completo


        setCurrentListItems(fetchedItems);
        setOriginalListItems(fetchedItems);
      } else {
        setCurrentMode('new');
      }

    } catch (error: any) {
      console.error("Error fetching shopping list items:", error);
      if (onError) {
        onError(`Não foi possível carregar a lista: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Efeito para carregar lista quando data ou listId específico muda
  useEffect(() => {

    // Prioridade 1: Se tiver specificListId (string), carregar essa lista específica
    if (specificListId) {
      fetchSpecificList(specificListId);
      return;
    }

    // Se specificListId === undefined (não null), significa modo "nova lista vazia"
    // Não carregar nada por data
    if (specificListId === undefined) {
      setCurrentListItems([]);
      setOriginalListItems([]);
      setCurrentMode('new');
      setIsLoading(false);
      return;
    }

    // Prioridade 2: Carregar por data se disponível (apenas quando specificListId === null)
    if (selectedDate && isValidDate(selectedDate)) {
      fetchExistingItemsForDate(selectedDate);
    } else {
      setCurrentListItems([]);
      setOriginalListItems([]);
      setCurrentMode('new');
      setIsLoading(false);
    }
  }, [specificListId, selectedDate, fetchSpecificList, fetchExistingItemsForDate]);

  // Adicionar insumo à lista
  const addSupply = useCallback((supply: Supply) => {
    if (!supply.id || !selectedDate) return;

    // Verificar se já existe
    setCurrentListItems(prev => {
      if (prev.some(item => item.supplyId === supply.id)) {
        if (onError) onError(`${supply.name} já foi adicionado.`);
        return prev;
      }

      const newItem: NewListItem = {
        supplyId: supply.id,
        name: supply.name,
        quantity: "",
        unit: supply.unit,
        preferredBrands: supply.preferredBrands || '',
        notes: '',
        deliveryDate: undefined,
        hasSpecificDate: false,
        status: 'Pendente',
        categoryId: supply.categoryId,
      };

      return [newItem, ...prev];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // Atualizar campo de item
  const updateItem = useCallback((supplyId: string, field: keyof NewListItem, value: any) => {
    setCurrentListItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.supplyId === supplyId);
      if (itemIndex === -1) return prevItems;

      const updatedItems = [...prevItems];
      const itemToUpdate = { ...updatedItems[itemIndex], [field]: value };

      // Se mudou deliveryDate, atualizar hasSpecificDate
      if (field === 'deliveryDate') {
        itemToUpdate.hasSpecificDate = !!value;
      }

      updatedItems[itemIndex] = itemToUpdate;
      return updatedItems;
    });
  }, []);

  // Deletar item
  const deleteItem = useCallback(async (item: NewListItem) => {
    if (!item) return;

    // Se existe no Firestore, deletar lá
    if (item.id) {
      try {
        const itemRefToDelete = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, item.id);
        await deleteDoc(itemRefToDelete);
        if (onSuccess) onSuccess(`${item.name} foi removido da lista.`);
      } catch (error: any) {
        if (onError) onError(`Erro ao remover: ${error.message}`);
        return;
      }
    }

    setCurrentListItems(prev => prev.filter(i => i.supplyId !== item.supplyId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Salvar lista no Firestore
  const saveList = useCallback(async (): Promise<string | null> => {
    if (!userId) {
      if (onError) onError("Você precisa estar logado para salvar uma lista.");
      return null;
    }
    if (!selectedDate) {
      if (onError) onError("Por favor, selecione uma data de entrega.");
      return null;
    }

    // Filtrar apenas itens com quantidade válida
    const itemsToSave = currentListItems.filter(item => {
      const qty = typeof item.quantity === 'string'
        ? parseFloat(item.quantity.replace(',', '.'))
        : item.quantity;
      return !isNaN(qty) && qty > 0;
    });

    if (itemsToSave.length === 0 && currentMode === 'new') {
      if (onError) onError("Adicione insumos com quantidade maior que zero para salvar.");
      return null;
    }

    setIsSaving(true);
    const batch = writeBatch(db);
    const listMainDateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const listId = currentListId && currentMode === 'edit'
      ? currentListId
      : new Date().getTime().toString();

    // Se está editando, deletar itens removidos
    if (currentMode === 'edit') {
      const currentItemIdsWithDocId = new Set(
        currentListItems.map(item => item.id).filter(id => !!id)
      );

      originalListItems.forEach(originalItem => {
        if (
          originalItem.id &&
          !currentItemIdsWithDocId.has(originalItem.id) &&
          originalItem.status === 'Pendente'
        ) {
          const itemRefToDelete = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, originalItem.id);
          batch.delete(itemRefToDelete);
        }
      });
    }

    // Salvar ou atualizar itens
    itemsToSave.forEach(item => {
      if (item.status !== 'Pendente') return;

      const { id: shoppingListItemDocId, ...dataToSaveWithoutDocId } = item;

      const numericQuantity = parseFloat(
        String(dataToSaveWithoutDocId.quantity).replace(',', '.')
      );

      if (isNaN(numericQuantity) || numericQuantity <= 0) {
        console.warn("Skipping item with invalid quantity:", item);
        return;
      }

      const finalDeliveryDate = dataToSaveWithoutDocId.deliveryDate || listMainDateTimestamp;
      const category = categories.find(c => c.id === item.categoryId);

      const dataToSave: Omit<ShoppingListItem, 'id' | 'createdAt' | 'updatedAt'> & {
        updatedAt: any;
        createdAt?: any;
      } = {
        listId: listId,
        supplyId: dataToSaveWithoutDocId.supplyId,
        name: dataToSaveWithoutDocId.name,
        quantity: numericQuantity,
        unit: dataToSaveWithoutDocId.unit,
        preferredBrands: dataToSaveWithoutDocId.preferredBrands || '',
        notes: dataToSaveWithoutDocId.notes || '',
        status: dataToSaveWithoutDocId.status,
        listDate: listMainDateTimestamp,
        deliveryDate: finalDeliveryDate,
        hasSpecificDate: !!dataToSaveWithoutDocId.deliveryDate,
        quotationId: item.quotationId || null,
        userId: userId,
        updatedAt: serverTimestamp(),
        categoryId: item.categoryId || '',
        categoryName: category ? category.name : DEFAULT_IMPORT_CATEGORY_NAME,
      };

      if (shoppingListItemDocId) {
        // Atualizar item existente
        const itemRef = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, shoppingListItemDocId);
        batch.update(itemRef, dataToSave as any);
      } else {
        // Criar novo item
        const newItemRef = doc(collection(db, SHOPPING_LIST_ITEMS_COLLECTION));
        batch.set(newItemRef, { ...dataToSave, createdAt: serverTimestamp() });
      }
    });

    try {
      await batch.commit();

      const pendingItemsCount = itemsToSave.filter(i => i.status === 'Pendente').length;

      if (onSuccess) {
        const message = pendingItemsCount > 0
          ? "Lista salva! Próximo passo: selecionar fornecedores."
          : "Lista salva!";
        onSuccess(message);
      }

      return listId;
    } catch (error: any) {
      console.error("Error saving list:", error);
      if (onError) {
        let description = "Não foi possível salvar a lista. Verifique sua conexão.";
        if (error.message?.includes('network') || error.message?.includes('ERR_BLOCKED_BY_CLIENT')) {
          description += " Se o problema persistir, tente desativar bloqueadores de anúncio (AdBlock).";
        } else {
          description += ` Detalhes: ${error.message}`;
        }
        onError(description);
      }
      return null;
    } finally {
      setIsSaving(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    selectedDate,
    currentListItems,
    originalListItems,
    currentListId,
    currentMode,
    categories,
  ]);

  // Refresh lista
  const refreshList = useCallback(async () => {
    if (selectedDate && isValidDate(selectedDate)) {
      await fetchExistingItemsForDate(selectedDate);
    }
  }, [selectedDate, fetchExistingItemsForDate]);

  // Contar itens pendentes
  const pendingItemsCount = useMemo(() => {
    return currentListItems.filter(item => {
      const qty = typeof item.quantity === 'string'
        ? parseFloat(item.quantity.replace(',', '.'))
        : item.quantity;
      return !isNaN(qty) && qty > 0 && item.status === 'Pendente';
    }).length;
  }, [currentListItems]);

  return {
    currentListItems,
    currentListId,
    currentMode,
    isLoading,
    isSaving,
    pendingItemsCount,
    addSupply,
    updateItem,
    deleteItem,
    saveList,
    refreshList,
  };
}
