
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from '@/components/ui/button';
import { PlusCircle, Upload, FolderPlus, Download, Edit, Trash2 as DeleteIcon, Loader2, Pencil, Settings } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription as DialogPrimitiveDescription } from '@/components/ui/dialog';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import { collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, serverTimestamp, query, orderBy, where, writeBatch, getDocs, getDoc } from 'firebase/firestore';
import type { SupplyCategory, Supply, UnitOfMeasure } from '@/types';
import { unitsOfMeasure } from '@/types';
import SuppliesTable from '@/components/features/supplies/SuppliesTable';
import AddSupplyModal from '@/components/features/supplies/AddSupplyModal';
import ConfirmDeleteSupplyDialog from '@/components/features/supplies/ConfirmDeleteSupplyDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { parse as csvParse, unparse as csvUnparse } from 'papaparse';
import { useCategories } from '@/contexts/CategoriesContext';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth

const SUPPLY_CATEGORIES_COLLECTION = 'supply_categories';
const SUPPLIES_COLLECTION = 'supplies';
const DEFAULT_IMPORT_CATEGORY_NAME = "Geral";

const categoryFormSchema = z.object({
  name: z.string().min(2, { message: "Nome da categoria é obrigatório (mínimo 2 caracteres)." }),
});
type CategoryFormValues = z.infer<typeof categoryFormSchema>;

export default function SuppliesClientPage() {
  const { categories, isLoadingCategories: isLoadingContextCategories, errorCategories, refreshCategories } = useCategories();
  const { user } = useAuth(); // Get the user from AuthContext
  const [allSupplies, setAllSupplies] = useState<Supply[]>([]);
  const [filteredSupplies, setFilteredSupplies] = useState<Supply[]>([]);
  const [activeTab, setActiveTab] = useState<string>("all");
  
  // State for Modals
  const [isAddCategoryModalOpen, setIsAddCategoryModalOpen] = useState(false);
  const [isEditCategoryModalOpen, setIsEditCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<SupplyCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<SupplyCategory | null>(null);

  const [isSupplyModalOpen, setIsSupplyModalOpen] = useState(false);
  const [editingSupply, setEditingSupply] = useState<Supply | null>(null);
  const [supplyToDelete, setSupplyToDelete] = useState<Supply | null>(null);

  const [isLoadingSupplies, setIsLoadingSupplies] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isManageCategoriesModalOpen, setIsManageCategoriesModalOpen] = useState(false);
  const { toast } = useToast();

  const categoryForm = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: "" },
  });

  // Effect to handle tab changes if a category is deleted
  useEffect(() => {
    if (activeTab !== "all" && !isLoadingContextCategories && categories.length > 0) {
      if (!categories.some(c => c.id === activeTab)) {
        setActiveTab("all");
      }
    }
  }, [categories, activeTab, isLoadingContextCategories]);

  // Effect to fetch supplies in real-time, now scoped to the user
  useEffect(() => {
    if (!user) { // Don't fetch if no user is logged in
      setAllSupplies([]);
      setIsLoadingSupplies(false);
      return;
    }
    setIsLoadingSupplies(true);
    const qSupplies = query(
        collection(db, SUPPLIES_COLLECTION), 
        where("userId", "==", user.uid), // Filter by user
        orderBy("name")
    );
    const unsubscribeSupplies = onSnapshot(qSupplies, (snapshotSupplies) => {
      const fetchedSupplies: Supply[] = snapshotSupplies.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as Supply));
      setAllSupplies(fetchedSupplies);
      setIsLoadingSupplies(false);
    }, (error) => {
      toast({ title: "Erro ao carregar insumos", description: error.message, variant: "destructive" });
      setIsLoadingSupplies(false);
    });
    return () => unsubscribeSupplies();
  }, [toast, user]); // Add user to dependency array

  // Effect to filter supplies based on tab and search term
  useEffect(() => {
    let suppliesToFilter = allSupplies;
    if (activeTab !== "all") {
      suppliesToFilter = suppliesToFilter.filter(supply => supply.categoryId === activeTab);
    }
    if (searchTerm) {
      const lowercasedFilter = searchTerm.toLowerCase();
      suppliesToFilter = suppliesToFilter.filter(supply =>
        supply.name.toLowerCase().includes(lowercasedFilter) ||
        (supply.categoryName && supply.categoryName.toLowerCase().includes(lowercasedFilter)) ||
        (supply.preferredBrands && supply.preferredBrands.toLowerCase().includes(lowercasedFilter))
      );
    }
    setFilteredSupplies(suppliesToFilter);
  }, [activeTab, allSupplies, searchTerm]);

  // --- CATEGORY CRUD FUNCTIONS ---
  
  const handleAddCategorySubmit: SubmitHandler<CategoryFormValues> = async (data) => {
    if (!user) return;
    const normalizedName = data.name.trim().toLowerCase();
    const q = query(collection(db, SUPPLY_CATEGORIES_COLLECTION), where("userId", "==", user.uid), where("name_lowercase", "==", normalizedName));
    const existing = await getDocs(q);

    if (!existing.empty) {
        toast({ title: "Categoria Duplicada", description: `A categoria "${data.name}" já existe.`, variant: "destructive" });
        return;
    }

    try {
      const newCategoryRef = await addDoc(collection(db, SUPPLY_CATEGORIES_COLLECTION), {
        name: data.name.trim(),
        name_lowercase: normalizedName,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });
      toast({ title: "Categoria Adicionada", description: `"${data.name}" foi adicionada com sucesso.` });
      setIsAddCategoryModalOpen(false);
      categoryForm.reset();
      await refreshCategories();
      setActiveTab(newCategoryRef.id);
    } catch (error: any) {
      let description = "Não foi possível adicionar a categoria. Verifique sua conexão com a internet.";
      if (error.message && (error.message.includes('network') || error.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
          description += " Se o problema persistir, tente desativar bloqueadores de anúncio (AdBlock).";
      }
      toast({ title: "Erro ao adicionar categoria", description, variant: "destructive", duration: 9000 });
    }
  };

  const handleEditCategoryClick = (category: SupplyCategory) => {
    setEditingCategory(category);
    categoryForm.reset({ name: category.name });
    setIsEditCategoryModalOpen(true);
  };

  const handleUpdateCategorySubmit: SubmitHandler<CategoryFormValues> = async (data) => {
    if (!editingCategory || !user) return;
    
    const newNormalizedName = data.name.trim().toLowerCase();
    if (newNormalizedName === editingCategory.name.toLowerCase()) {
        setIsEditCategoryModalOpen(false);
        return; // No change
    }
    
    const q = query(collection(db, SUPPLY_CATEGORIES_COLLECTION), where("userId", "==", user.uid), where("name_lowercase", "==", newNormalizedName));
    const existing = await getDocs(q);
    if (!existing.empty && existing.docs[0].id !== editingCategory.id) {
        toast({ title: "Categoria Duplicada", description: `A categoria "${data.name}" já existe.`, variant: "destructive" });
        return;
    }

    const batch = writeBatch(db);
    const categoryRef = doc(db, SUPPLY_CATEGORIES_COLLECTION, editingCategory.id);
    
    batch.update(categoryRef, { name: data.name.trim(), name_lowercase: newNormalizedName });

    try {
        const suppliesQuery = query(collection(db, SUPPLIES_COLLECTION), where("userId", "==", user.uid), where("categoryId", "==", editingCategory.id));
        const suppliesSnapshot = await getDocs(suppliesQuery);
        
        suppliesSnapshot.forEach(supplyDoc => {
            batch.update(supplyDoc.ref, { categoryName: data.name.trim() });
        });

        await batch.commit();

        toast({ title: "Categoria Atualizada", description: `"${editingCategory.name}" foi renomeada para "${data.name}".` });
        setIsEditCategoryModalOpen(false);
        setEditingCategory(null);
        categoryForm.reset();
        await refreshCategories();
    } catch (error: any) {
      let description = "Não foi possível atualizar a categoria. Verifique sua conexão com a internet.";
      if (error.message && (error.message.includes('network') || error.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
          description += " Se o problema persistir, tente desativar bloqueadores de anúncio (AdBlock).";
      }
      toast({ title: "Erro ao atualizar categoria", description, variant: "destructive", duration: 9000 });
    }
  };
  
  const handleDeleteCategory = async () => {
    if (!categoryToDelete || !user) return;

    const suppliesQuery = query(collection(db, SUPPLIES_COLLECTION), where("userId", "==", user.uid), where("categoryId", "==", categoryToDelete.id));
    const suppliesSnapshot = await getDocs(suppliesQuery);

    if (!suppliesSnapshot.empty) {
      toast({ title: "Categoria em Uso", description: `Remova ou mova ${suppliesSnapshot.size} insumo(s) antes de excluir a categoria "${categoryToDelete.name}".`, variant: "destructive", duration: 7000 });
      setCategoryToDelete(null);
      return;
    }

    try {
      await deleteDoc(doc(db, SUPPLY_CATEGORIES_COLLECTION, categoryToDelete.id));
      toast({ title: "Categoria Removida", description: `"${categoryToDelete.name}" foi removida.` });
      setCategoryToDelete(null);
      await refreshCategories();
      setActiveTab("all"); 
    } catch (error: any) {
      toast({ title: "Erro ao remover categoria", description: error.message, variant: "destructive" });
    }
  };
  
  // --- IMPORT / EXPORT FUNCTIONS ---
  
  const handleImportSupplies = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoadingSupplies(true);
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      try {
        let defaultCategoryId: string;
        let defaultCategoryName: string = DEFAULT_IMPORT_CATEGORY_NAME;

        const categoryQuery = query(collection(db, SUPPLY_CATEGORIES_COLLECTION), where("userId", "==", user.uid), where("name_lowercase", "==", DEFAULT_IMPORT_CATEGORY_NAME.toLowerCase()));
        const categorySnapshot = await getDocs(categoryQuery);

        if (categorySnapshot.empty) {
          toast({ title: "Criando Categoria Padrão", description: `A categoria "${DEFAULT_IMPORT_CATEGORY_NAME}" será criada para os insumos importados.` });
          const newCategoryRef = await addDoc(collection(db, SUPPLY_CATEGORIES_COLLECTION), {
              name: DEFAULT_IMPORT_CATEGORY_NAME,
              name_lowercase: DEFAULT_IMPORT_CATEGORY_NAME.toLowerCase(),
              userId: user.uid,
              createdAt: serverTimestamp(),
          });
          defaultCategoryId = newCategoryRef.id;
          await refreshCategories();
        } else {
          defaultCategoryId = categorySnapshot.docs[0].id;
        }

        const result = csvParse<any>(text, {
          header: true,
          skipEmptyLines: true,
          transformHeader: header => header.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '_'),
        });

        if (result.errors.length > 0) throw new Error(`Formato CSV/TXT inválido: ${result.errors[0].message}`);

        const supplyBatch = writeBatch(db);
        let successfullyImportedCount = 0;
        const skippedItemsLog: { name: string, reason: string }[] = [];
        
        const existingSuppliesSnapshot = await getDocs(query(collection(db, SUPPLIES_COLLECTION), where("userId", "==", user.uid), where("categoryId", "==", defaultCategoryId)));
        const existingSupplyNames = new Set(existingSuppliesSnapshot.docs.map(doc => doc.data().name.toLowerCase()));
        const processedInThisBatch = new Set<string>();

        result.data.forEach((row: any) => {
          const supplyName = String(row['nome_do_insumo'] || row['insumo'] || '').trim();
          if (!supplyName) {
            skippedItemsLog.push({ name: "(Nome Vazio)", reason: "Nome do insumo não fornecido." });
            return;
          }

          const normalizedSupplyName = supplyName.toLowerCase();
          if (existingSupplyNames.has(normalizedSupplyName) || processedInThisBatch.has(normalizedSupplyName)) {
            skippedItemsLog.push({ name: supplyName, reason: `Insumo já existe na categoria "${defaultCategoryName}".` });
            return;
          }

          const unitValue = String(row['unidade'] || unitsOfMeasure[0]).trim();
          const supplyUnit = unitsOfMeasure.includes(unitValue as UnitOfMeasure) ? unitValue as UnitOfMeasure : unitsOfMeasure[0];
          const quantityInStock = parseFloat(String(row['quantidade_em_estoque'] || row['estoque'] || '0').replace(',', '.').trim());

          const supplyData: Omit<Supply, 'id' | 'createdAt' | 'updatedAt'> = {
            name: supplyName,
            name_lowercase: normalizedSupplyName,
            unit: supplyUnit,
            categoryId: defaultCategoryId,
            categoryName: defaultCategoryName,
            userId: user.uid,
            preferredBrands: String(row['marcas_preferidas'] || row['marcas'] || '').trim(),
            notes: String(row['observacoes'] || '').trim(),
            quantityInStock: isNaN(quantityInStock) ? 0 : quantityInStock,
          };
          
          const supplyRef = doc(collection(db, SUPPLIES_COLLECTION));
          supplyBatch.set(supplyRef, { ...supplyData, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
          processedInThisBatch.add(normalizedSupplyName);
          successfullyImportedCount++;
        });

        if (successfullyImportedCount > 0) await supplyBatch.commit();

        if (successfullyImportedCount > 0) {
            toast({ title: "Importação Concluída", description: `${successfullyImportedCount} insumos importados para a categoria "${defaultCategoryName}". ${skippedItemsLog.length} foram ignorados.` });
        } else {
            toast({ title: "Nenhum Insumo Importado", description: `Verifique seu arquivo. ${skippedItemsLog.length} itens foram ignorados.`, variant: "destructive" });
        }
        if (skippedItemsLog.length > 0) { /* Some items were skipped, but we won't log them to the console. */ }

      } catch (err: any) {
        let description = `Não foi possível processar o arquivo: ${err.message}`;
        if (err.message && (err.message.includes('network') || err.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
            description = "Falha na importação. Verifique sua conexão ou desative bloqueadores de anúncio e tente novamente.";
        }
        toast({ title: "Erro na Importação", description, variant: "destructive", duration: 9000 });
      } finally {
        setIsLoadingSupplies(false);
        setActiveTab(activeTab);
        event.target.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  };

  const handleExportSupplies = useCallback(() => {
    if (allSupplies.length === 0) {
      toast({ title: "Nada para Exportar", description: "Sua lista de insumos está vazia.", variant: "destructive" });
      return;
    }
    const csvData = allSupplies.map(s => ({
      "Nome do Insumo": s.name, "Unidade": s.unit, "Nome da Categoria": s.categoryName,
      "Marcas Preferidas": s.preferredBrands || '', "Observações": s.notes || '',
      "Quantidade em Estoque": s.quantityInStock ?? 0
    }));
    const csvString = csvUnparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "insumos_exportados.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportação Concluída", description: "Sua lista foi salva como insumos_exportados.csv." });
  }, [allSupplies, toast]);

  // --- SUPPLY CRUD FUNCTIONS ---

  const handleAddNewSupplyClick = () => {
    if (categories.length === 0 && !isLoadingContextCategories) {
      toast({ title: "Crie uma Categoria Primeiro", description: "É necessário ter ao menos uma categoria para adicionar um insumo.", variant: "destructive" });
      return;
    }
    setEditingSupply(null);
    setIsSupplyModalOpen(true);
  };

  const handleEditSupplyClick = (supply: Supply) => {
    setEditingSupply(supply);
    setIsSupplyModalOpen(true);
  };

  const handleDeleteSupplyClick = (supply: Supply) => setSupplyToDelete(supply);

  const confirmDeleteSupply = async () => {
    if (!supplyToDelete) return;
    try {
      await deleteDoc(doc(db, SUPPLIES_COLLECTION, supplyToDelete.id));
      toast({ title: "Insumo Removido", description: `"${supplyToDelete.name}" foi removido com sucesso.` });
      setSupplyToDelete(null);
    } catch (error: any) {
      toast({ title: "Erro ao remover insumo", description: error.message, variant: "destructive" });
    }
  };

  const handleSaveSupply = async (supplyData: Omit<Supply, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'name_lowercase'>) => {
    if (!user) return;
    const category = categories.find(cat => cat.id === supplyData.categoryId);
    if (!category) {
      toast({ title: "Erro: Categoria Inválida", description: "A categoria selecionada não foi encontrada.", variant: "destructive" });
      return;
    }

    const normalizedName = supplyData.name.trim().toLowerCase();
    const dataForFirestore = {
      ...supplyData,
      name: supplyData.name.trim(),
      name_lowercase: normalizedName,
      categoryName: category.name,
      userId: user.uid,
      notes: supplyData.notes || "",
      preferredBrands: supplyData.preferredBrands || "",
      quantityInStock: supplyData.quantityInStock ?? 0,
    };

    try {
      const q = query(collection(db, SUPPLIES_COLLECTION), where("userId", "==", user.uid), where("name_lowercase", "==", normalizedName), where("categoryId", "==", dataForFirestore.categoryId));
      const existing = await getDocs(q);
      
      if (editingSupply) {
        if (!existing.empty && existing.docs.some(d => d.id !== editingSupply.id)) {
            toast({ title: "Insumo Duplicado", description: `O insumo "${dataForFirestore.name}" já existe nesta categoria.`, variant: "destructive" });
            return;
        }
        await updateDoc(doc(db, SUPPLIES_COLLECTION, editingSupply.id), { ...dataForFirestore, updatedAt: serverTimestamp() });
        toast({ title: "Insumo Atualizado", description: `"${dataForFirestore.name}" foi atualizado.` });
      } else {
        if (!existing.empty) {
            toast({ title: "Insumo Duplicado", description: `O insumo "${dataForFirestore.name}" já existe nesta categoria.`, variant: "destructive" });
            return;
        }
        await addDoc(collection(db, SUPPLIES_COLLECTION), { ...dataForFirestore, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
        toast({ title: "Insumo Adicionado", description: `"${dataForFirestore.name}" foi adicionado.` });
      }
      setIsSupplyModalOpen(false);
      setEditingSupply(null);
    } catch (error: any) {
      let description = "Não foi possível salvar o insumo. Verifique sua conexão com a internet.";
      if (error.message && (error.message.includes('network') || error.message.includes('ERR_BLOCKED_BY_CLIENT'))) {
          description += " Se o problema persistir, tente desativar bloqueadores de anúncio (AdBlock).";
      }
      toast({ title: "Erro ao salvar insumo", description: description, variant: "destructive", duration: 9000 });
    }
  };

  const isLoadingPageData = isLoadingContextCategories || isLoadingSupplies;

  return (
    <div className="space-y-6">
      
      <Card className="card-professional modern-shadow-xl hover-lift">
        <CardHeader className="p-4 md:p-6 border-b header-modern">
          <div className="flex flex-col lg:flex-row lg:items-center gap-4">
             {/* Campo de Busca */}
             <div className="relative flex-1 max-w-md">
                <Input type="search" placeholder="Buscar insumo por nome, categoria, marca..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full input-modern" />
             </div>

             {/* Separador vertical (apenas em telas grandes) */}
             <div className="hidden lg:block h-8 w-px bg-border"></div>

             {/* Botões de Ação */}
             <div className="flex-shrink-0">
                <div className="flex flex-wrap gap-2">
                   <input type="file" id="import-supplies-input" accept=".csv,.txt" onChange={handleImportSupplies} className="hidden" />
                   <Button variant="outline" onClick={() => document.getElementById('import-supplies-input')?.click()} disabled={isLoadingContextCategories} className="hover-lift">
                      <Upload className="mr-2 h-4 w-4 rotate-hover" /> Importar
                   </Button>
                   <Button variant="outline" onClick={handleExportSupplies} disabled={allSupplies.length === 0} className="hover-lift">
                      <Download className="mr-2 h-4 w-4 rotate-hover" /> Exportar
                   </Button>
                   <Button variant="outline" onClick={() => setIsAddCategoryModalOpen(true)} disabled={isLoadingContextCategories} className="hover-lift">
                      <FolderPlus className="mr-2 h-4 w-4 rotate-hover" /> Nova Categoria
                   </Button>
                   <Button onClick={handleAddNewSupplyClick} className="button-modern" disabled={isLoadingContextCategories || categories.length === 0}>
                      <PlusCircle className="mr-2 h-4 w-4 rotate-hover" /> Adicionar Insumo
                   </Button>
                </div>
             </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 md:p-6">
          {isLoadingContextCategories && categories.length === 0 ? (
            <div className="flex flex-col justify-center items-center h-60">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-lg text-muted-foreground">Carregando categorias...</p>
            </div>
          ) : errorCategories ? (
            <div className="text-destructive p-4 text-center bg-destructive/10 rounded-md">
              <p><strong>Erro:</strong> {errorCategories}</p>
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <div className="border-b pb-2 mb-4 overflow-x-auto custom-scrollbar">
                <div className="flex items-center gap-2">
                  <TabsList className="h-auto p-1 card-professional flex-nowrap flex-1">
                    <TabsTrigger
                      key="all-tab"
                      value="all"
                      className="nav-item-modern data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                    >
                      Todos os Insumos
                    </TabsTrigger>
                    {categories.map(category => (
                      <TabsTrigger
                        key={category.id}
                        value={category.id}
                        className="nav-item-modern data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md"
                      >
                        <span className="truncate max-w-[150px]">{category.name}</span>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setIsManageCategoriesModalOpen(true)}
                    className="hover-lift flex-shrink-0"
                    title="Gerenciar Categorias"
                  >
                    <Settings className="h-4 w-4 rotate-hover" />
                  </Button>
                </div>
              </div>
              <TabsContent value={activeTab} className="mt-0">
                {isLoadingSupplies ? (
                    <div className="flex justify-center items-center h-40">
                      <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      <span className="ml-2 text-muted-foreground">Carregando insumos...</span>
                    </div>
                ) : (
                    <SuppliesTable supplies={filteredSupplies} onEdit={handleEditSupplyClick} onDelete={handleDeleteSupplyClick} />
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Category Modals */}
      <Dialog open={isAddCategoryModalOpen} onOpenChange={setIsAddCategoryModalOpen}>
        <DialogContent className="card-professional modern-shadow-xl">
            <DialogHeader className="fade-in"><DialogTitle className="text-gradient">Adicionar Nova Categoria</DialogTitle></DialogHeader>
            <form onSubmit={categoryForm.handleSubmit(handleAddCategorySubmit)} className="space-y-4">
                <div className="slide-in-up">
                    <label htmlFor="categoryName">Nome da Categoria *</label>
                    <Input id="categoryName" placeholder="Ex: Laticínios, Grãos" className="input-modern" {...categoryForm.register("name")} />
                    {categoryForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{categoryForm.formState.errors.name.message}</p>}
                </div>
                <DialogFooter className="slide-in-up">
                    <Button type="button" variant="outline" onClick={() => setIsAddCategoryModalOpen(false)} className="transition-colors">Cancelar</Button>
                    <Button type="submit" disabled={categoryForm.formState.isSubmitting} className="button-modern">
                        {categoryForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Adicionar
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>
      <Dialog open={isEditCategoryModalOpen} onOpenChange={setIsEditCategoryModalOpen}>
        <DialogContent className="card-professional modern-shadow-xl">
            <DialogHeader className="fade-in"><DialogTitle className="text-gradient">Editar Categoria</DialogTitle></DialogHeader>
            <form onSubmit={categoryForm.handleSubmit(handleUpdateCategorySubmit)} className="space-y-4">
                <div className="slide-in-up">
                    <label htmlFor="editCategoryName">Novo Nome da Categoria *</label>
                    <Input id="editCategoryName" className="input-modern" {...categoryForm.register("name")} />
                    {categoryForm.formState.errors.name && <p className="text-sm text-destructive mt-1">{categoryForm.formState.errors.name.message}</p>}
                </div>
                <DialogFooter className="slide-in-up">
                    <Button type="button" variant="outline" onClick={() => setIsEditCategoryModalOpen(false)} className="transition-colors">Cancelar</Button>
                    <Button type="submit" disabled={categoryForm.formState.isSubmitting} className="button-modern">
                        {categoryForm.formState.isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2"/>} Salvar Alterações
                    </Button>
                </DialogFooter>
            </form>
        </DialogContent>
      </Dialog>

      {/* Manage Categories Modal */}
      <Dialog open={isManageCategoriesModalOpen} onOpenChange={setIsManageCategoriesModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Gerenciar Categorias</DialogTitle>
            <DialogPrimitiveDescription>
              Edite ou exclua categorias existentes
            </DialogPrimitiveDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
            {categories.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">Nenhuma categoria cadastrada</p>
            ) : (
              categories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                  <span className="font-medium">{category.name}</span>
                  <div className="flex gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setIsManageCategoriesModalOpen(false);
                        handleEditCategoryClick(category);
                      }}
                      className="h-8 w-8 hover:bg-accent"
                      title="Editar categoria"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => {
                        setIsManageCategoriesModalOpen(false);
                        setCategoryToDelete(category);
                      }}
                      className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                      title="Excluir categoria"
                    >
                      <DeleteIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
          <DialogFooter>
            <Button type="button" onClick={() => setIsManageCategoriesModalOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation and Supply Modals */}
      {categoryToDelete && (
        <AlertDialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle><AlertDialogDescription>Tem certeza que deseja remover a categoria &quot;{categoryToDelete.name}&quot;? Esta ação não pode ser desfeita.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={handleDeleteCategory}>Remover</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isSupplyModalOpen && (
        <AddSupplyModal isOpen={isSupplyModalOpen} onClose={() => { setIsSupplyModalOpen(false); setEditingSupply(null); }} onSave={handleSaveSupply} supply={editingSupply} />
      )}

      {supplyToDelete && (
        <ConfirmDeleteSupplyDialog isOpen={!!supplyToDelete} onClose={() => setSupplyToDelete(null)} onConfirm={confirmDeleteSupply} supplyName={supplyToDelete.name} />
      )}
    </div>
  );
}
