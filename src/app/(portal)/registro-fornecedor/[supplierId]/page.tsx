
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm, SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/config/firebase';
import { doc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

import type { Fornecedor } from '@/types';
import { Loader2, Send, Building, User, Phone, UploadCloud, AlertTriangle, CalendarDays } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Checkbox } from '@/components/ui/checkbox';

const daysOfWeek = [
  { id: 'segunda', label: 'Segunda' }, { id: 'terca', label: 'Terça' },
  { id: 'quarta', label: 'Quarta' }, { id: 'quinta', label: 'Quinta' },
  { id: 'sexta', label: 'Sexta' }, { id: 'sabado', label: 'Sábado' },
  { id: 'domingo', label: 'Domingo' },
];

const fornecedorSchema = z.object({
  empresa: z.string().min(2, "Nome da empresa é obrigatório (mín. 2 caracteres)."),
  cnpj: z.string()
    .min(14, "CNPJ é obrigatório e deve ter 14 dígitos.")
    .max(18, "CNPJ inválido (máx. 18 caracteres com pontuação).")
    .regex(/^\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}$|^\d{14}$/, "Formato de CNPJ inválido."),
  vendedor: z.string().min(2, "Nome do vendedor é obrigatório (mín. 2 caracteres)."),
  whatsapp: z.string().min(10, "WhatsApp é obrigatório (mín. 10 dígitos).").regex(/^\+?\d{10,15}$/, "Formato de WhatsApp inválido. Use apenas números (ex: 11999998888). O código do país (55) será adicionado automaticamente."),
  email: z.string().email("Formato de email inválido.").optional().or(z.literal('')),
  pin: z.string()
    .min(4, "O PIN deve ter entre 4 e 6 dígitos.")
    .max(6, "O PIN deve ter entre 4 e 6 dígitos.")
    .regex(/^\d{4,6}$/, "O PIN deve conter apenas números."),
  fotoFile: z.instanceof(File).optional().nullable(),
  diasDeEntrega: z.array(z.string()).refine((value) => value.some(Boolean), {
    message: "Selecione pelo menos um dia de entrega.",
  }),
});

type FornecedorFormValues = z.infer<typeof fornecedorSchema>;

const FORNECEDORES_COLLECTION = 'fornecedores';

export default function CompleteSupplierRegistrationPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const { toast } = useToast();
  
  const [supplier, setSupplier] = useState<Fornecedor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<FornecedorFormValues>({
    resolver: zodResolver(fornecedorSchema),
    defaultValues: {
      empresa: '',
      cnpj: '',
      vendedor: '',
      whatsapp: '',
      email: '',
      pin: '',
      fotoFile: null,
      diasDeEntrega: [],
    },
  });

  useEffect(() => {
    if (!supplierId) {
      setError("ID do fornecedor não encontrado no link.");
      setIsLoading(false);
      return;
    }

    const fetchSupplier = async () => {
      const docRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data() as Fornecedor;
        if (data.status === 'ativo') {
          setError("Este convite já foi utilizado. O cadastro já está ativo.");
        } else {
          setSupplier({ ...data, id: docSnap.id });
          form.reset({
            empresa: data.empresa || '',
            cnpj: data.cnpj || '',
            vendedor: data.vendedor || '',
            whatsapp: data.whatsapp || '',
            email: data.email || '',
            pin: '',
            fotoFile: null,
            diasDeEntrega: data.diasDeEntrega || [],
          });
        }
      } else {
        setError("Convite inválido ou não encontrado.");
      }
      setIsLoading(false);
    };

    fetchSupplier();
  }, [supplierId, form]);

  // Simple hash function for PIN (using SHA-256)
  const hashPin = async (pin: string): Promise<string> => {
    try {
      // Try using Web Crypto API first (works in HTTPS and localhost)
      if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
        const encoder = new TextEncoder();
        const data = encoder.encode(pin);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }
    } catch (e) {
      console.warn('Web Crypto API not available, using fallback hash');
    }

    // Fallback: Simple hash for development (not cryptographically secure, but works)
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const onSubmit: SubmitHandler<FornecedorFormValues> = async (data) => {
    if (!supplier) {
        toast({ title: "Erro Interno", description: "Dados do fornecedor não encontrados.", variant: "destructive"});
        return;
    }

    console.log('📝 [Registration] Dados do formulário recebidos:', {
        empresa: data.empresa,
        hasFotoFile: !!data.fotoFile,
        fotoFileName: data.fotoFile?.name
    });

    form.setValue("empresa", data.empresa, { shouldValidate: true }); // Trigger validation display

    try {
        // 1. Handle image upload (if any)
        const { fotoFile, pin, email } = data;
        let fotoUrl = supplier.fotoUrl || 'https://placehold.co/40x40.png';
        let fotoHint = supplier.fotoHint || 'generic logo';

        if (fotoFile) {
            console.log('📸 [Upload] Iniciando upload do arquivo:', {
                name: fotoFile.name,
                type: fotoFile.type,
                size: fotoFile.size
            });
            toast({ title: "Enviando logo...", description: "Aguarde um momento." });
            try {
                const response = await fetch(`/api/upload?filename=${encodeURIComponent(fotoFile.name)}`, {
                  method: 'POST',
                  body: fotoFile,
                });
                console.log('📸 [Upload] Resposta da API:', {
                    status: response.status,
                    ok: response.ok
                });
                const newBlob = await response.json();
                console.log('📸 [Upload] Blob retornado:', newBlob);
                if (!response.ok) throw new Error(newBlob.message || 'Falha no upload da imagem.');
                fotoUrl = newBlob.url;
                fotoHint = "custom logo";
                console.log('✅ [Upload] Upload concluído com sucesso:', fotoUrl);
            } catch (uploadError: any) {
                console.error("❌ [Upload] FALHA NO UPLOAD DA LOGO:", uploadError);
                toast({
                    title: "Aviso: Falha no Upload da Logo",
                    description: uploadError.message || "O cadastro continuará com a imagem padrão.",
                    variant: "destructive",
                    duration: 9000,
                });
            }
        } else {
            console.log('⚠️ [Upload] Nenhum arquivo selecionado');
        }

        // 2. Hash the PIN for security
        const hashedPin = await hashPin(pin);

        // 3. Prepare the data to update in Firestore
        const cleanedCnpj = data.cnpj.replace(/[^\d]/g, "");
        let cleanedWhatsapp = data.whatsapp.replace(/[^\d]/g, "");

        // Automatically add '55' prefix if not present
        if (!cleanedWhatsapp.startsWith('55')) {
            cleanedWhatsapp = '55' + cleanedWhatsapp;
        }

        const dataToUpdate: any = {
            empresa: data.empresa.trim(),
            cnpj: cleanedCnpj,
            vendedor: data.vendedor.trim(),
            whatsapp: cleanedWhatsapp,
            diasDeEntrega: data.diasDeEntrega,
            pin: hashedPin,
            fotoUrl,
            fotoHint,
            status: 'ativo' as const,
            updatedAt: serverTimestamp(),
        };

        // Add email if provided (not File object!)
        if (email && typeof email === 'string' && email.trim()) {
            dataToUpdate.email = email.trim();
        }

        // 4. Update the supplier document
        console.log('📝 [Registration] Data to update:', dataToUpdate);
        const docRef = doc(db, FORNECEDORES_COLLECTION, supplier.id);
        await updateDoc(docRef, dataToUpdate);

        toast({
            title: "Cadastro Finalizado!",
            description: `Bem-vindo(a), ${data.empresa}! Seu cadastro foi concluído.`,
            duration: 7000,
        });

        // 5. Redirect to the supplier portal
        router.push(`/portal/${supplier.id}`);

    } catch (error: any) {
        // Handle errors (auth or firestore)
        console.error("ERRO NO CADASTRO:", error);
        const defaultErrorMessage = "Ocorreu um erro desconhecido. Tente novamente.";
        let errorMessage = defaultErrorMessage;

        if (error.code) { // Firebase error codes
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'Este email já está em uso. Por favor, utilize outro.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'O email fornecido é inválido.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'A senha é muito fraca. Tente uma mais forte.';
                    break;
                default:
                    errorMessage = error.message || defaultErrorMessage;
                    break;
            }
        }
        
        toast({
            title: "Erro ao Finalizar Cadastro",
            description: errorMessage,
            variant: "destructive",
        });
    }
  };


  if (isLoading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Verificando convite...</p></div>;
  }
  
  if (error) {
    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center min-h-[calc(100vh-200px)]">
          <Card className="w-full max-w-lg text-center shadow-xl">
            <CardHeader>
              <div className="mx-auto bg-destructive/10 p-3 rounded-full w-fit">
                <AlertTriangle className="h-10 w-10 text-destructive" />
              </div>
              <CardTitle className="mt-4 text-2xl font-bold text-destructive">{error}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Por favor, verifique o link com o administrador ou solicite um novo convite.</p>
            </CardContent>
          </Card>
        </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 sm:p-6 md:p-8">
      <Card className="w-full max-w-2xl shadow-2xl rounded-xl overflow-hidden">
        <CardHeader className="bg-primary text-primary-foreground p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <Building className="h-8 w-8" />
            <div>
              <CardTitle className="text-2xl sm:text-3xl font-bold">Finalize seu Cadastro</CardTitle>
              <CardDescription className="text-primary-foreground/80 text-sm sm:text-base pt-1">
                Bem-vindo(a), {supplier?.empresa}! Complete seus dados abaixo.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <CardContent className="p-6 sm:p-8 space-y-6">
            
            <FormField control={form.control} name="empresa" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><Building className="h-4 w-4 text-primary" /> Nome da Empresa *</FormLabel>
                <FormControl><Input {...field} placeholder="Ex: Sua Empresa Ltda." className="text-base"/></FormControl>
                <FormMessage />
              </FormItem>
            )}/>

            <FormField control={form.control} name="cnpj" render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary lucide lucide-badge-percent"><path d="M3.85 8.62a4 4 0 0 1 4.78-4.78l8.74 8.74a4 4 0 0 1-4.78 4.78Z"/><path d="m12 15-2-2"/><path d="M17.59 10.18a4 4 0 0 0-5.76-5.76M15 12l2 2"/></svg> CNPJ *</FormLabel>
                <FormControl><Input {...field} placeholder="00.000.000/0000-00" className="text-base"/></FormControl>
                <FormMessage />
              </FormItem>
            )}/>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="vendedor" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Nome do Contato/Vendedor *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: João da Silva" className="text-base"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="whatsapp" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><Phone className="h-4 w-4 text-primary" /> WhatsApp *</FormLabel>
                    <FormControl><Input {...field} placeholder="Ex: 11999998888 (55 será adicionado automaticamente)" className="text-base"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField control={form.control} name="email" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary lucide lucide-mail"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Email (Opcional)</FormLabel>
                    <FormControl><Input {...field} type="email" placeholder="seu@email.com" className="text-base"/></FormControl>
                    <FormMessage />
                  </FormItem>
                )}/>
                <FormField control={form.control} name="pin" render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary lucide lucide-key-round"><path d="M2 18v3c0 .6.4 1 1 1h4v-3h3v-3h2l1.4-1.4a6.5 6.5 0 1 0-4-4Z"/><circle cx="16.5" cy="7.5" r=".5"/></svg> Senha de Acesso *</FormLabel>
                    <FormControl><Input {...field} type="password" inputMode="numeric" placeholder="Digite 4-6 números" maxLength={6} className="text-base"/></FormControl>
                    <FormMessage />
                    <p className="text-xs text-muted-foreground">Esta senha será usada para acessar o portal do fornecedor</p>
                  </FormItem>
                )}/>
            </div>
            
            <FormField control={form.control} name="diasDeEntrega" render={() => (
              <FormItem>
                 <FormLabel className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-primary"/> Grade de Entrega (Dias que você entrega) *</FormLabel>
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

            <FormField control={form.control} name="fotoFile" render={({ field }) => (
                <FormItem>
                    <FormLabel className="flex items-center gap-2"><UploadCloud className="h-4 w-4 text-primary" /> Logo da Empresa (Opcional)</FormLabel>
                    <FormControl>
                        <Input id="fotoFile" type="file" accept="image/*" name={field.name} ref={field.ref} onBlur={field.onBlur}
                            onChange={(e) => field.onChange(e.target.files ? e.target.files[0] : undefined)}
                            className="border-border shadow-sm focus:ring-primary/80 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 text-base"
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}/>
          </CardContent>
          <CardFooter className="bg-muted/50 p-6 sm:p-8 border-t">
            <Button type="submit" className="w-full text-lg py-3 rounded-lg bg-accent hover:bg-accent/90 text-accent-foreground shadow-md" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Send className="mr-2 h-5 w-5" />
              )}
              {form.formState.isSubmitting ? 'Salvando...' : 'Finalizar Cadastro'}
            </Button>
          </CardFooter>
        </form>
        </Form>
      </Card>
    </div>
  );
}
