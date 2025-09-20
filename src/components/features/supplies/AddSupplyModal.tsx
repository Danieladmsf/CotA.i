
"use client";

import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useForm, SubmitHandler, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import type { Supply, UnitOfMeasure } from '@/types';
import { unitsOfMeasure } from '@/types';
import { useCategories } from '@/contexts/CategoriesContext';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const supplyFormSchema = z.object({
  name: z.string().min(2, "Nome do insumo é obrigatório (mín. 2 caracteres)."),
  unit: z.custom<UnitOfMeasure>((val) => unitsOfMeasure.includes(val as UnitOfMeasure), {
    message: "Unidade de medida inválida.",
  }),
  categoryId: z.string().min(1, "Categoria é obrigatória."),
  preferredBrands: z.string().optional(),
  notes: z.string().optional(),
  quantityInStock: z.preprocess(
    (val) => (String(val).trim() === "" || val === undefined || val === null ? undefined : Number(String(val).replace(',', '.'))),
    z.number({ invalid_type_error: "Estoque deve ser um número." }).min(0, "Estoque não pode ser negativo.").optional()
  ),
});

type SupplyFormValues = z.infer<typeof supplyFormSchema>;

interface AddSupplyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (supplyData: Omit<Supply, 'id' | 'createdAt' | 'updatedAt' | 'userId'>) => Promise<void>;
  supply?: Supply | null; // For editing
}

export default function AddSupplyModal({ isOpen, onClose, onSave, supply }: AddSupplyModalProps) {
  const { user } = useAuth();
  const { categories, isLoadingCategories } = useCategories();
  
  const form = useForm<SupplyFormValues>({
    resolver: zodResolver(supplyFormSchema),
    defaultValues: {
      name: '',
      unit: unitsOfMeasure[0],
      categoryId: '',
      preferredBrands: '',
      notes: '',
      quantityInStock: undefined,
    },
  });

  useEffect(() => {
    if (isOpen) {
      if (supply) {
        form.reset({
          name: supply.name,
          unit: supply.unit,
          categoryId: supply.categoryId,
          preferredBrands: supply.preferredBrands || '',
          notes: supply.notes || '',
          quantityInStock: supply.quantityInStock ?? undefined,
        });
      } else {
        form.reset({
          name: '',
          unit: unitsOfMeasure[0],
          categoryId: categories.length > 0 && !isLoadingCategories ? categories[0].id : '',
          preferredBrands: '',
          notes: '',
          quantityInStock: undefined,
        });
      }
    }
  }, [supply, form, isOpen, categories, isLoadingCategories]);

  const handleSubmitWrapper: SubmitHandler<SupplyFormValues> = async (data) => {
    if (!user) {
      console.error("No user found, cannot save supply.");
      return;
    }
    const dataToSave = {
      ...data,
      quantityInStock: data.quantityInStock === undefined ? 0 : data.quantityInStock,
    };
    await onSave(dataToSave as Omit<Supply, 'id' | 'createdAt' | 'updatedAt' | 'userId'>);
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      form.reset();
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border shadow-xl rounded-xl">
        <DialogHeader className="p-6 pb-4">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {supply ? "Editar Insumo" : "Adicionar Novo Insumo"}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground pt-1">
            {supply ? "Atualize os detalhes do insumo." : "Preencha os detalhes do novo insumo."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(handleSubmitWrapper)} className="px-6 space-y-4 max-h-[calc(80vh-120px)] overflow-y-auto custom-scrollbar">
          <div>
            <label htmlFor="supplyName" className="block text-sm font-medium text-foreground/90 mb-1">Nome do Insumo *</label>
            <Input id="supplyName" {...form.register("name")} placeholder="Ex: Farinha de Trigo" className="border-border shadow-sm focus:ring-primary/80" />
            {form.formState.errors.name && <p className="text-sm text-destructive mt-1">{form.formState.errors.name.message}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-foreground/90 mb-1">Unidade de Medida *</label>
              <Controller
                name="unit"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || unitsOfMeasure[0]} defaultValue={unitsOfMeasure[0]}>
                    <SelectTrigger id="unit" className="border-border shadow-sm focus:ring-primary/80">
                      <SelectValue placeholder="Selecione a unidade" />
                    </SelectTrigger>
                    <SelectContent>
                      {unitsOfMeasure.map(uom => <SelectItem key={uom} value={uom}>{uom}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.unit && <p className="text-sm text-destructive mt-1">{form.formState.errors.unit.message}</p>}
            </div>
            <div>
              <label htmlFor="categoryId" className="block text-sm font-medium text-foreground/90 mb-1">Categoria *</label>
              <Controller
                name="categoryId"
                control={form.control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''} defaultValue={field.value || ''} disabled={isLoadingCategories}>
                    <SelectTrigger id="categoryId" className="border-border shadow-sm focus:ring-primary/80">
                      <SelectValue placeholder={isLoadingCategories ? "Carregando..." : "Selecione a categoria"} />
                    </SelectTrigger>
                    <SelectContent>
                      {isLoadingCategories && <SelectItem value="loading" disabled>Carregando categorias...</SelectItem>}
                      {!isLoadingCategories && categories.length === 0 && <SelectItem value="no-cat" disabled>Nenhuma categoria encontrada</SelectItem>}
                      {categories.map(cat => <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              />
              {form.formState.errors.categoryId && <p className="text-sm text-destructive mt-1">{form.formState.errors.categoryId.message}</p>}
            </div>
          </div>
          
          <div>
            <label htmlFor="preferredBrands" className="block text-sm font-medium text-foreground/90 mb-1">Marcas Preferidas (separadas por vírgula)</label>
            <Input id="preferredBrands" {...form.register("preferredBrands")} placeholder="Ex: Marca A, Marca B" className="border-border shadow-sm focus:ring-primary/80" />
          </div>
          
          <div>
            <label htmlFor="quantityInStock" className="block text-sm font-medium text-foreground/90 mb-1">Quantidade em Estoque</label>
            <Input id="quantityInStock" type="number" step="any" {...form.register("quantityInStock")} placeholder="Ex: 10.5" className="border-border shadow-sm focus:ring-primary/80" />
            {form.formState.errors.quantityInStock && <p className="text-sm text-destructive mt-1">{form.formState.errors.quantityInStock.message}</p>}
          </div>

          <div>
            <label htmlFor="notes" className="block text-sm font-medium text-foreground/90 mb-1">Observações</label>
            <Textarea id="notes" {...form.register("notes")} placeholder="Detalhes adicionais sobre o insumo..." className="border-border shadow-sm focus:ring-primary/80 min-h-[80px]" />
          </div>
          
          <DialogFooter className="pt-6 pb-2 sticky bottom-0 bg-card border-t border-border -mx-6 px-6">
            <Button type="button" variant="outline" onClick={handleOpenChange.bind(null,false)} className="rounded-full px-6 py-3 text-base border-border hover:bg-muted/80">
              Cancelar
            </Button>
            <Button type="submit" className="rounded-full px-6 py-3 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg" disabled={form.formState.isSubmitting || isLoadingCategories}>
              {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
              {form.formState.isSubmitting ? "Salvando..." : (supply ? "Salvar Alterações" : "Adicionar Insumo")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
