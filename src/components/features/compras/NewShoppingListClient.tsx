
"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select as SelectPrimitive, SelectContent as SelectPrimitiveContent, SelectItem as SelectPrimitiveItem, SelectTrigger as SelectPrimitiveTrigger, SelectValue as SelectPrimitiveValue } from "@/components/ui/select";
import type { Supply, SupplyCategory, ShoppingListItem, UnitOfMeasure, Quotation } from '@/types';
import { unitsOfMeasure } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, getDocs, writeBatch, query, orderBy, Timestamp, doc, where, serverTimestamp, deleteDoc, onSnapshot } from 'firebase/firestore';
import { format, isValid as isValidDate, startOfDay, endOfDay, addDays, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle, PlusCircle, Save, Trash2, Loader2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Lock } from 'lucide-react';
import { closeQuotationAndItems } from '@/actions/quotationActions';
import { useAuth } from '@/contexts/AuthContext';


interface NewListItem {
  id?: string; // from Firestore
  listId?: string;
  supplyId: string;
  name: string;
  quantity: number | string;
  unit: UnitOfMeasure;
  preferredBrands?: string;
  notes?: string;
  status: 'Pendente' | 'Cotado' | 'Comprado' | 'Recebido' | 'Cancelado' | 'Encerrado';
  deliveryDate?: Timestamp; // Optional for UI
  hasSpecificDate?: boolean; // Tracks if the user explicitly set a date for this item
  quotationId?: string;
  categoryId?: string;
}

const SUPPLIES_COLLECTION = 'supplies';
const SUPPLY_CATEGORIES_COLLECTION = 'supply_categories';
const SHOPPING_LIST_ITEMS_COLLECTION = 'shopping_list_items';
const DEFAULT_IMPORT_CATEGORY_NAME = "Geral";

interface NewShoppingListClientProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onListSaved: (listId: string, date: Date) => void;
}

export default function NewShoppingListClient({ selectedDate, onDateChange, onListSaved }: NewShoppingListClientProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allSupplies, setAllSupplies] = useState<Supply[]>([]);
  const [categories, setCategories] = useState<SupplyCategory[]>([]);
  const [currentListItems, setCurrentListItems] = useState<NewListItem[]>([]);
  const [originalListItems, setOriginalListItems] = useState<NewListItem[]>([]);
  const [currentListId, setCurrentListId] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'new' | 'edit'>('new');

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeSelectionTab, setActiveSelectionTab] = useState<string>("all");
  const [searchTermSupplies, setSearchTermSupplies] = useState('');
  const [lastAddedSupplyId, setLastAddedSupplyId] = useState<string | null>(null);

  const quantityInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredSuppliesForSelection = useMemo(() => {
    let suppliesToFilter = [...allSupplies];
    if (activeSelectionTab !== "all") {
      suppliesToFilter = suppliesToFilter.filter(supply => supply.categoryId === activeSelectionTab);
    }
    if (searchTermSupplies) {
      const lowercasedFilter = searchTermSupplies.toLowerCase();
      suppliesToFilter = suppliesToFilter.filter(s => s.name.toLowerCase().includes(lowercasedFilter) || (s.preferredBrands && s.preferredBrands.toLowerCase().includes(lowercasedFilter)));
    }
    return suppliesToFilter;
  }, [activeSelectionTab, allSupplies, searchTermSupplies]);

  const itemsToSave = useMemo(() => {
    return currentListItems.filter(item => {
      const qty = typeof item.quantity === 'string' ? parseFloat(item.quantity.replace(',', '.')) : item.quantity;
      return !isNaN(qty) && qty > 0;
    });
  }, [currentListItems]);

  useEffect(() => {
    if (!user) {
      setIsLoadingData(false);
      return;
    }
    setIsLoadingData(true);
    try {
      const qCategories = query(collection(db, SUPPLY_CATEGORIES_COLLECTION), where("userId", "==", user.uid), orderBy("name"));
      const qSupplies = query(collection(db, SUPPLIES_COLLECTION), where("userId", "==", user.uid), orderBy("name"));

      const unsubCategories = onSnapshot(qCategories, (snapshot) => {
        setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as SupplyCategory)));
      });

      const unsubSupplies = onSnapshot(qSupplies, (snapshot) => {
        setAllSupplies(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Supply)));
      });

      return () => {
        unsubCategories();
        unsubSupplies();
      };
    } catch (error: any) {
      toast({ title: "Erro ao carregar dados", description: `Não foi possível buscar insumos/categorias: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [user]); // Removido toast das dependências

  const fetchExistingItemsForDate = useCallback(async (date: Date) => {
      if (!user) {
        setIsLoadingData(false);
        setCurrentListItems([]);
        return;
      }
      setIsLoadingData(true);
      setCurrentListItems([]);
      setOriginalListItems([]);
      setCurrentListId(null);
      setCurrentMode('new');

      try {
        const startOfSelectedDay = startOfDay(date);
        const endOfSelectedDay = endOfDay(date);
        
        // 1. Fetch all items for the selected day for the current user
        const allItemsForDayQuery = query(
          collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
          where("userId", "==", user.uid),
          where("listDate", ">=", Timestamp.fromDate(startOfSelectedDay)),
          where("listDate", "<=", Timestamp.fromDate(endOfSelectedDay)),
          orderBy("listDate", "desc")
        );
        const snapshot = await getDocs(allItemsForDayQuery);
        const allItems = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ShoppingListItem));

        // 2. Group items by listId
        const lists = allItems.reduce((acc, item) => {
          const listId = item.listId || 'unassigned';
          if (!acc[listId]) {
            acc[listId] = [];
          }
          acc[listId].push(item);
          return acc;
        }, {} as Record<string, ShoppingListItem[]>);

        // 3. Find the most recent list that is still editable (not fully quoted)
        const sortedListIds = Object.keys(lists).sort((a, b) => parseInt(b) - parseInt(a));
        
        let listToLoad: ShoppingListItem[] | null = null;
        let loadedListId: string | null = null;

        for (const listId of sortedListIds) {
          const itemsInList = lists[listId];
          const isEditable = itemsInList.some(item => !item.quotationId && item.status === 'Pendente');
          
          if (isEditable) {
            listToLoad = itemsInList;
            loadedListId = listId;
            break;
          }
        }

        if (listToLoad && loadedListId) {
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
            } as NewListItem))
            .filter(item => item.status !== 'Encerrado');

          const sortedItems = fetchedItems.sort((a, b) => a.name.localeCompare(b.name));
          setCurrentListItems(sortedItems);
          setOriginalListItems(sortedItems);
        } else {
          setCurrentMode('new');
        }

      } catch (error: any) {
        console.error("Error fetching shopping list items:", error);
        toast({ title: "Erro ao carregar lista", description: `Verifique sua conexão e se os índices do Firestore estão corretos. Detalhes: ${error.message}`, variant: "destructive", duration: 10000 });
      } finally {
        setIsLoadingData(false);
      }
  }, [user]); // Removido toast das dependências

  useEffect(() => {
    if (selectedDate && isValidDate(selectedDate)) {
        fetchExistingItemsForDate(selectedDate);
    } else {
        setCurrentListItems([]);
        setOriginalListItems([]);
        setCurrentMode('new');
        setIsLoadingData(false);
    }
  }, [selectedDate, fetchExistingItemsForDate]);


  useEffect(() => {
    if (lastAddedSupplyId && quantityInputRefs.current[lastAddedSupplyId]) {
      const inputElement = quantityInputRefs.current[lastAddedSupplyId];
      inputElement?.focus();
      inputElement?.select();

      const itemCard = document.getElementById(`item-card-${lastAddedSupplyId}`);
      itemCard?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [lastAddedSupplyId]);

  const handleAddSupplyToList = (supply: Supply) => {
    if (!supply.id || !selectedDate) return;

    if (currentListItems.some(item => item.supplyId === supply.id)) {
      toast({ title: "Item já na lista", description: `${supply.name} já foi adicionado.` });
      const inputRef = quantityInputRefs.current[supply.id];
      if (inputRef) {
        inputRef.focus();
        inputRef.select();
      }
      return;
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

    setCurrentListItems(prev => [...prev, newItem].sort((a, b) => a.name.localeCompare(b.name)));
    setLastAddedSupplyId(supply.id);
  };

  const handleUpdateListItem = (supplyIdToListKey: string, field: keyof NewListItem, value: any) => {
    setCurrentListItems(prevItems => {
      const itemIndex = prevItems.findIndex(item => item.supplyId === supplyIdToListKey);
      if (itemIndex === -1) return prevItems;

      const updatedItems = [...prevItems];
      const itemToUpdate = { ...updatedItems[itemIndex], [field]: value };
      
      if (field === 'deliveryDate') {
        itemToUpdate.hasSpecificDate = !!value;
      }
      
      updatedItems[itemIndex] = itemToUpdate;
      return updatedItems;
    });
  };

  const handleRemoveListItem = (supplyIdToRemove: string) => {
    setCurrentListItems(prev => prev.filter(item => item.supplyId !== supplyIdToRemove));
  };

  const handleSaveList = async () => {
    if (!user) {
      toast({ title: "Acesso Negado", description: "Você precisa estar logado para salvar uma lista.", variant: "destructive" });
      return;
    }
    if (!selectedDate) {
      toast({ title: "Data de Entrega Necessária", description: "Por favor, selecione uma data de entrega.", variant: "destructive" });
      return;
    }
    if (itemsToSave.length === 0 && currentMode === 'new') {
      toast({ title: "Lista Inválida", description: "Adicione insumos com quantidade maior que zero para salvar.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    const batch = writeBatch(db);
    const listMainDateTimestamp = Timestamp.fromDate(startOfDay(selectedDate));
    const listId = currentListId && currentMode === 'edit' ? currentListId : new Date().getTime().toString();

    if (currentMode === 'edit') {
      const currentItemIdsWithDocId = new Set(currentListItems.map(item => item.id).filter(id => !!id));
      originalListItems.forEach(originalItem => {
        if (originalItem.id && !currentItemIdsWithDocId.has(originalItem.id) && originalItem.status === 'Pendente') {
          const itemRefToDelete = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, originalItem.id);
          batch.delete(itemRefToDelete);
        }
      });
    }

    itemsToSave.forEach(item => {
      if(item.status !== 'Pendente') return;

      const { id: shoppingListItemDocId, ...dataToSaveWithoutDocId } = item;

      const numericQuantity = parseFloat(String(dataToSaveWithoutDocId.quantity).replace(',', '.'));
      if (isNaN(numericQuantity) || numericQuantity <= 0) {
        console.warn("Skipping item with invalid quantity:", item);
        return;
      }
      
      const finalDeliveryDate = dataToSaveWithoutDocId.deliveryDate || listMainDateTimestamp;

      const category = categories.find(c => c.id === item.categoryId);

      const dataToSave: Omit<ShoppingListItem, 'id' | 'createdAt' | 'updatedAt'> & { updatedAt: any, createdAt?: any } = {
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
        userId: user.uid,
        updatedAt: serverTimestamp(),
        categoryId: item.categoryId,
        categoryName: category ? category.name : DEFAULT_IMPORT_CATEGORY_NAME,
      };

      if (shoppingListItemDocId) {
        const itemRef = doc(db, SHOPPING_LIST_ITEMS_COLLECTION, shoppingListItemDocId);
        batch.update(itemRef, dataToSave as any);
      } else {
        const newItemRef = doc(collection(db, SHOPPING_LIST_ITEMS_COLLECTION));
        batch.set(newItemRef, { ...dataToSave, createdAt: serverTimestamp() });
      }
    });

    try {
      await batch.commit();
      
      const pendingItemsCount = itemsToSave.filter(i => i.status === 'Pendente').length;
      let toastMessage = `A lista de compras foi salva.`;
      
      if (pendingItemsCount > 0) {
        toastMessage += " Próximo passo: selecionar fornecedores.";
        onListSaved(listId, selectedDate);
      } else {
        await fetchExistingItemsForDate(selectedDate);
      }

      toast({ title: "Lista Salva!", description: toastMessage, variant: "default", action: <CheckCircle className="h-5 w-5 text-green-500" /> });

      setLastAddedSupplyId(null);
    } catch (error: any) {
      console.error("Error saving list:", error);
      let description = "Não foi possível salvar a lista. Verifique sua conexão com a internet.";
      if (error.message && (error.message.includes('network') || error.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
          description += " Se o problema persistir, tente desativar bloqueadores de anúncio (AdBlock) para este site, pois eles podem interferir na comunicação com o banco de dados.";
      } else {
          description += ` Detalhes: ${error.message}`;
      }
      toast({
          title: "Erro ao Salvar Lista",
          description: description,
          variant: "destructive",
          duration: 9000
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuantityKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      setLastAddedSupplyId(null);
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    }
  };
  
  const handlePreviousDay = () => {
    onDateChange(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    onDateChange(addDays(selectedDate, 1));
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      onDateChange(date);
    }
  };
  
  const pendingItemsToSaveCount = useMemo(() => {
    return itemsToSave.filter(item => item.status === 'Pendente').length;
  }, [itemsToSave]);


  return (
    <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between pb-4 border-b gap-4">
            <div className="flex items-center flex-wrap">
                <Button variant="outline" size="icon" onClick={handlePreviousDay} disabled={!selectedDate} className="rounded-r-none border-r-0">
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only">Dia anterior</span>
                </Button>
                 <Popover>
                      <PopoverTrigger asChild>
                          <Button variant="outline" className="min-w-[240px] justify-start text-left font-normal rounded-none">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {selectedDate ? format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR }) : <span>Selecione uma data</span>}
                          </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                          <Calendar mode="single" selected={selectedDate} onSelect={handleDateSelect} initialFocus locale={ptBR} />
                      </PopoverContent>
                  </Popover>
                <Button variant="outline" size="icon" onClick={handleNextDay} disabled={!selectedDate} className="rounded-l-none border-l-0">
                  <ChevronRight className="h-4 w-4" />
                  <span className="sr-only">Próximo dia</span>
                </Button>
            </div>
          <h1 className="text-xl md:text-2xl font-bold text-center order-first sm:order-none">
            {currentMode === 'edit' ? `Editando Lista` : `Nova Lista`}
          </h1>
          <Button onClick={handleSaveList} disabled={isSaving || isLoadingData || pendingItemsToSaveCount === 0} className="min-w-[160px] w-full sm:w-auto">
            {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
            {currentMode === 'edit' ? 'Salvar e Cotar' : 'Salvar e Avançar'} ({pendingItemsToSaveCount})
          </Button>
        </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="shadow-lg rounded-xl">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-xl">Selecionar Insumos</CardTitle>
            <div className="mt-2">
              <Input ref={searchInputRef} placeholder="Buscar insumo por nome ou marca..." value={searchTermSupplies} onChange={(e) => setSearchTermSupplies(e.target.value)} disabled={(isLoadingData && !allSupplies.length) || !selectedDate} />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Tabs value={activeSelectionTab} onValueChange={setActiveSelectionTab} className="w-full">
              <div className="border-b overflow-x-auto">
                <TabsList className="h-auto rounded-none p-2 bg-muted/50 justify-start">
                  <TabsTrigger value="all" disabled={!selectedDate}>Todos</TabsTrigger>
                  {categories.map(cat => <TabsTrigger key={cat.id} value={cat.id} disabled={!selectedDate}>{cat.name}</TabsTrigger>)}
                </TabsList>
              </div>
              <TabsContent value={activeSelectionTab} className="mt-0 p-4 max-h-[calc(100vh-380px)] min-h-[300px] overflow-y-auto">
                {!selectedDate ? <p className="text-muted-foreground text-center py-8">Selecione uma data para começar.</p>
                : (isLoadingData && allSupplies.length === 0) ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                : filteredSuppliesForSelection.length === 0 ? <p className="text-muted-foreground text-center py-8">Nenhum insumo encontrado.</p>
                :
                <ul className="space-y-2">
                  {filteredSuppliesForSelection.map(supply => (
                    <li key={supply.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                      <div>
                        <p className="font-medium">{supply.name} <span className="text-xs text-muted-foreground">({supply.unit})</span></p>
                        {supply.preferredBrands && <p className="text-xs text-blue-600">Marcas: {supply.preferredBrands}</p>}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handleAddSupplyToList(supply)} disabled={currentListItems.some(item => item.supplyId === supply.id)}>
                        <PlusCircle className="h-4 w-4 mr-1.5" /> Adicionar
                      </Button>
                    </li>
                  ))}
                </ul>
                }
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <Card className="shadow-lg rounded-xl">
          <CardHeader className="border-b p-4">
            <CardTitle className="text-xl">Itens da Lista ({currentListItems.length})</CardTitle>
            <CardDescription>Defina as quantidades, datas de entrega e observações para cada item.</CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3 max-h-[calc(100vh-260px)] overflow-y-auto">
            {!selectedDate ? <p className="text-muted-foreground text-center py-8">Selecione uma data para ver os itens da lista.</p>
            : (isLoadingData && currentMode === 'edit') ? <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
            : currentListItems.length === 0 ? <p className="text-muted-foreground text-center py-8">Sua lista está vazia. Adicione insumos do painel à esquerda.</p>
            :
            currentListItems.map((item) => {
              const isLocked = item.status !== 'Pendente';
              return (
                <div key={item.supplyId} id={`item-card-${item.supplyId}`} className={`relative p-3 border rounded-lg space-y-2 shadow-sm transition-all duration-300 ${lastAddedSupplyId === item.supplyId ? 'bg-primary/10 border-primary/40' : 'bg-background'} ${isLocked ? 'bg-muted/30 opacity-70' : ''}`}>
                  {isLocked && <div className="absolute top-2 right-2 text-muted-foreground flex items-center gap-1 text-xs"><Lock size={12}/> {item.status}</div>}
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-base">{item.name}</p>
                    <Button variant="ghost" size="icon" onClick={() => handleRemoveListItem(item.supplyId)} disabled={isLocked} className="text-destructive h-7 w-7">
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Remover {item.name} da lista</span>
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label htmlFor={`quantity-${item.supplyId}`} className="text-xs text-muted-foreground block mb-0.5">Quantidade</label>
                      <Input id={`quantity-${item.supplyId}`} ref={el => { quantityInputRefs.current[item.supplyId] = el; }} type="text" inputMode="decimal" value={item.quantity} onFocus={() => setLastAddedSupplyId(item.supplyId)} onChange={(e) => handleUpdateListItem(item.supplyId, 'quantity', e.target.value)} onKeyDown={handleQuantityKeyDown} disabled={isLocked} />
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor={`unit-${item.supplyId}`} className="text-xs text-muted-foreground block mb-0.5">Unidade</label>
                      <SelectPrimitive value={item.unit} onValueChange={(value) => handleUpdateListItem(item.supplyId, 'unit', value as UnitOfMeasure)} disabled={isLocked}>
                        <SelectPrimitiveTrigger id={`unit-${item.supplyId}`}><SelectPrimitiveValue /></SelectPrimitiveTrigger>
                        <SelectPrimitiveContent>
                          {unitsOfMeasure.map(uom => <SelectPrimitiveItem key={uom} value={uom}>{uom}</SelectPrimitiveItem>)}
                        </SelectPrimitiveContent>
                      </SelectPrimitive>
                    </div>
                    <div className="sm:col-span-1">
                      <label htmlFor={`date-${item.supplyId}`} className="text-xs text-muted-foreground block mb-0.5">Data Entrega</label>
                       <Popover>
                          <PopoverTrigger asChild>
                              <Button variant={'outline'} className="w-full justify-start text-left font-normal" disabled={isLocked}>
                                  <CalendarIcon className="mr-2 h-4 w-4" />
                                  {item.deliveryDate ? format(item.deliveryDate.toDate(), "dd/MM/yy", {locale: ptBR}) : <span className="text-muted-foreground">Padrão da Lista</span>}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                              <Calendar
                                  mode="single"
                                  selected={item.deliveryDate?.toDate()}
                                  onSelect={(date) => {
                                      handleUpdateListItem(item.supplyId, 'deliveryDate', date ? Timestamp.fromDate(date) : undefined)
                                  }}
                                  defaultMonth={selectedDate}
                                  initialFocus
                              />
                          </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                  <div>
                    <label htmlFor={`notes-${item.supplyId}`} className="text-xs text-muted-foreground block mb-0.5">Observações</label>
                    <Textarea id={`notes-${item.supplyId}`} value={item.notes || ''} onFocus={() => setLastAddedSupplyId(item.supplyId)} onChange={(e) => handleUpdateListItem(item.supplyId, 'notes', e.target.value)} placeholder="Detalhes para este item..." rows={1} className="min-h-[40px]" disabled={isLocked} />
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
