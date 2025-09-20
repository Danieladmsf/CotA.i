
"use client";

import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2 } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';
import type { Fornecedor } from '@/types';
import { useAuth } from '@/contexts/AuthContext';


const daysOfWeek = [
  { id: 'segunda', label: 'Segunda' }, { id: 'terca', label: 'Terça' },
  { id: 'quarta', label: 'Quarta' }, { id: 'quinta', label: 'Quinta' },
  { id: 'sexta', label: 'Sexta' }, { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
];

const fornecedorFormSchema = z.object({
  empresa: z.string().min(2, "Nome da empresa é obrigatório (mín. 2 caracteres)."),
  cnpj: z.string()
    .min(14, "CNPJ é obrigatório e deve ter no mínimo 14 caracteres (ex: XX.XXX.XXX/XXXX-XX ou XXXXXXXXXXXXXX).")
    .max(18, "CNPJ pode ter no máximo 18 caracteres (ex: XX.XXX.XXX/XXXX-XX)."),
  vendedor: z.string().min(2, "Nome do vendedor é obrigatório (mín. 2 caracteres)."),
  whatsapp: z.string().min(10, "WhatsApp é obrigatório (mín. 10 caracteres). Inclua o código do país (ex: 5511999998888).").regex(/^\+?\d{10,15}$/, "Formato de WhatsApp inválido."),
  fotoFile: z.instanceof(File).optional().nullable(),
  diasDeEntrega: z.array(z.string()).refine((value) => value.length > 0, {
    message: "Selecione pelo menos um dia de entrega.",
  }),
});

export type FornecedorFormValues = z.infer<typeof fornecedorFormSchema>;

interface AddOrEditFornecedorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: FornecedorFormValues) => Promise<void>;
  fornecedor?: Fornecedor | null; // For editing
}

export default function AddFornecedorModal({ isOpen, onClose, onSave, fornecedor }: AddOrEditFornecedorModalProps) {
  const { user } = useAuth();
  const form = useForm<FornecedorFormValues>({
    resolver: zodResolver(fornecedorFormSchema),
    defaultValues: {
      empresa: '',
      cnpj: '',
      vendedor: '',
      whatsapp: '',
      fotoFile: null,
      diasDeEntrega: [],
    },
  });
  
  const isEditing = !!fornecedor;

  useEffect(() => {
    if (isOpen) {
      if (isEditing && fornecedor) {
        form.reset({
          empresa: fornecedor.empresa,
          cnpj: fornecedor.cnpj,
          vendedor: fornecedor.vendedor,
          whatsapp: fornecedor.whatsapp,
          diasDeEntrega: fornecedor.diasDeEntrega || [],
          fotoFile: null,
        });
      } else {
        form.reset({
          empresa: '',
          cnpj: '',
          vendedor: '',
          whatsapp: '',
          diasDeEntrega: [],
          fotoFile: null,
        });
      }
    }
  }, [isOpen, fornecedor, isEditing, form]);

  const handleSubmitWrapper: SubmitHandler<FornecedorFormValues> = async (data) => {
    if (!user) {
      // This check is mostly for type safety, as the parent component should handle this.
      console.error("No user found, cannot save supplier.");
      return;
    }
    await onSave(data);
  };
  
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border shadow-xl rounded-xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b">
          <DialogTitle className="text-2xl font-bold tracking-tight text-foreground">
            {isEditing ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}
          </DialogTitle>
          <DialogDescription className="text-muted-foreground pt-1">
            {isEditing ? 'Atualize os dados do fornecedor.' : 'Preencha os detalhes do novo fornecedor.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitWrapper)} className="flex flex-col flex-1 min-h-0">
            <div className="px-6 py-4 space-y-4 flex-1 overflow-y-auto custom-scrollbar">
              <FormField control={form.control} name="empresa" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome da Empresa *</FormLabel>
                  <FormControl><Input placeholder="Ex: Empresa Fantasia Ltda" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ *</FormLabel>
                  <FormControl><Input placeholder="Ex: 00.000.000/0001-00" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="vendedor" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do Vendedor *</FormLabel>
                  <FormControl><Input placeholder="Ex: João Silva" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="whatsapp" render={({ field }) => (
                <FormItem>
                  <FormLabel>WhatsApp (com código do país) *</FormLabel>
                  <FormControl><Input placeholder="Ex: 5511999998888" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}/>
              <FormField control={form.control} name="diasDeEntrega" render={() => (
                <FormItem>
                  <FormLabel>Grade de Entrega *</FormLabel>
                   <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 rounded-md border p-4">
                    {daysOfWeek.map((day) => (
                      <FormField
                        key={day.id}
                        control={form.control}
                        name="diasDeEntrega"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), day.id])
                                    : field.onChange(field.value?.filter((value) => value !== day.id));
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal text-sm">{day.label}</FormLabel>
                          </FormItem>
                        )}
                      />
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}/>

              <FormField control={form.control} name="fotoFile" render={({ field: { onChange, value, ...rest }}) => (
                  <FormItem>
                      <FormLabel>Foto/Logo (Opcional)</FormLabel>
                      <FormControl>
                          <Input 
                              {...rest}
                              type="file" 
                              accept="image/*" 
                              onChange={(e) => onChange(e.target.files ? e.target.files[0] : null)} 
                              className="border-border shadow-sm focus:ring-primary/80 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                          />
                      </FormControl>
                      <FormMessage/>
                  </FormItem>
              )}/>
            </div>
            
            <DialogFooter className="px-6 py-4 mt-auto border-t flex-shrink-0">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="rounded-full px-6 py-3 text-base border-border hover:bg-muted/80">
                Cancelar
              </Button>
              <Button type="submit" className="rounded-full px-6 py-3 text-base bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                {form.formState.isSubmitting ? "Salvando..." : (isEditing ? "Salvar Alterações" : "Adicionar Fornecedor")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
