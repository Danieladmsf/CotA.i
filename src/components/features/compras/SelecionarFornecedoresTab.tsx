
"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/config/firebase';
import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
} from 'firebase/firestore';
import type { Fornecedor } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Send, Calendar as IconCalendar, UserCheck, AlertTriangle, Timer, Bell } from 'lucide-react';
import { startQuotation } from '@/actions/quotationActions';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

const FORNECEDORES_COLLECTION = 'fornecedores';

interface SelecionarFornecedoresTabProps {
  shoppingListDate: Date | null;
  listId: string | null;
  onQuotationStarted: () => void;
}

export default function SelecionarFornecedoresTab({ shoppingListDate, listId, onQuotationStarted }: SelecionarFornecedoresTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [allSuppliers, setAllSuppliers] = useState<Fornecedor[]>([]);
  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(true);
  const [isStartingQuotation, setIsStartingQuotation] = useState(false);
  
  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>();
  const [deadlineTime, setDeadlineTime] = useState<string>("17:00");
  const [counterOfferTime, setCounterOfferTime] = useState('15');
  const [reminderPercentage, setReminderPercentage] = useState('50');


  useEffect(() => {
    if (!user) {
      setIsLoadingSuppliers(false);
      setAllSuppliers([]);
      return;
    }
    setIsLoadingSuppliers(true);
    const q = query(
      collection(db, FORNECEDORES_COLLECTION),
      where("status", "==", "ativo"),
      where("userId", "==", user.uid),
      orderBy("empresa")
    );

    getDocs(q).then(snapshot => {
      const fetchedSuppliers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fornecedor));
      setAllSuppliers(fetchedSuppliers);
    }).catch(error => {
      let description = error.message;
      if (error.code === 'failed-precondition') {
          description = "A consulta ao banco de dados falhou. Isso geralmente significa que um índice composto é necessário. Verifique o console do desenvolvedor (F12) para obter um link para criar o índice. O erro completo foi logado no console.";
      }
      
      toast({ title: "Erro ao buscar fornecedores", description: description, variant: "destructive", duration: 10000 });
    }).finally(() => {
      setIsLoadingSuppliers(false);
    });
  }, [toast, user]);

  const handleSupplierSelection = (supplierId: string, checked: boolean) => {
    setSelectedSuppliers(prev => ({ ...prev, [supplierId]: checked }));
  };

  const selectedSupplierIds = Object.keys(selectedSuppliers).filter(id => selectedSuppliers[id]);

  const handleStartQuotation = async () => {
    if (!user) {
      toast({ title: "Acesso Negado", description: "Você precisa estar logado para iniciar uma cotação.", variant: "destructive" });
      return;
    }
    if (!shoppingListDate || !listId) {
      toast({ title: "Dados da Lista Ausentes", description: "Não foi possível identificar a lista de compras para criar a cotação.", variant: "destructive" });
      return;
    }
    if (selectedSupplierIds.length === 0) {
      toast({ title: "Nenhum fornecedor selecionado", description: "Por favor, selecione pelo menos um fornecedor para iniciar a cotação.", variant: "destructive" });
      return;
    }
    if (!deadlineDate) {
      toast({ title: "Prazo não definido", description: "Por favor, defina a data e hora limite para a cotação.", variant: "destructive" });
      return;
    }
    const timeValue = parseInt(counterOfferTime, 10);
    if (isNaN(timeValue) || timeValue <= 0) {
      toast({ title: "Tempo de contraproposta inválido", description: "Por favor, insira um número de minutos positivo.", variant: "destructive" });
      return;
    }
    const reminderValue = parseInt(reminderPercentage, 10);
    if (isNaN(reminderValue) || reminderValue < 0 || reminderValue > 100) {
        toast({ title: "Valor de lembrete inválido", description: "A porcentagem do lembrete deve ser entre 0 e 100.", variant: "destructive" });
        return;
    }

    const [hours, minutes] = deadlineTime.split(':').map(Number);
    const finalDeadline = new Date(deadlineDate);
    finalDeadline.setHours(hours, minutes, 0, 0);

    if (finalDeadline < new Date()) {
      toast({ title: "Data Inválida", description: "O prazo da cotação não pode ser no passado.", variant: "destructive" });
      return;
    }

    setIsStartingQuotation(true);

    const formattedDeadlineForMessage = format(finalDeadline, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });

    try {
      const result = await startQuotation(
        listId,
        shoppingListDate.toISOString(),
        selectedSupplierIds,
        finalDeadline.toISOString(),
        timeValue,
        reminderValue,
        formattedDeadlineForMessage,
        user.uid
      );

      if (!result.success) {
        throw new Error(result.error || "Ocorreu um erro desconhecido no servidor.");
      }

      toast({
        title: "Cotação Iniciada!",
        description: `Convites enviados para ${selectedSupplierIds.length} fornecedor(es). Redirecionando...`,
      });

      onQuotationStarted();

    } catch (error: any) {
      toast({ title: "Erro ao iniciar cotação", description: error.message, variant: "destructive" });
    } finally {
      setIsStartingQuotation(false);
    }
  };


  if (!shoppingListDate) {
    return (
        <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
                <p className="text-lg font-semibold text-foreground">Crie ou carregue uma lista de compras primeiro.</p>
                <p className="text-muted-foreground mt-2">
                    Para selecionar fornecedores, você precisa primeiro ter uma lista de compras salva no &quot;Passo 1&quot;.
                </p>
            </CardContent>
        </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Selecionar Fornecedores</CardTitle>
          <CardDescription>Marque os fornecedores que participarão da cotação para a lista de <span className="font-semibold">{format(shoppingListDate, "dd/MM/yyyy")}</span>.</CardDescription>
        </CardHeader>
        <CardContent className="max-h-[500px] overflow-y-auto">
          {isLoadingSuppliers ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : allSuppliers.length === 0 ? (
             <p className="text-muted-foreground text-center p-4">Nenhum fornecedor ativo encontrado. Cadastre um na página &quot;Fornecedores&quot;.</p>
          ) : (
            <div className="space-y-3">
              {allSuppliers.map(supplier => (
                <label key={supplier.id} htmlFor={`supplier-${supplier.id}`} className="flex items-center gap-4 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors">
                  <Checkbox 
                    id={`supplier-${supplier.id}`} 
                    checked={!!selectedSuppliers[supplier.id]}
                    onCheckedChange={(checked) => handleSupplierSelection(supplier.id, !!checked)}
                  />
                  <Image src={supplier.fotoUrl && (supplier.fotoUrl.startsWith('http') || supplier.fotoUrl.startsWith('data:')) ? supplier.fotoUrl : 'https://placehold.co/40x40.png'} alt={supplier.empresa} width={40} height={40} className="rounded-full object-cover" data-ai-hint={supplier.fotoHint} />
                  <div className="flex-grow">
                    <p className="font-semibold">{supplier.empresa}</p>
                    <p className="text-sm text-muted-foreground">{supplier.vendedor}</p>
                  </div>
                </label>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="sticky top-6">
        <CardHeader>
            <CardTitle>Definir Prazos e Iniciar</CardTitle>
            <CardDescription>Defina o prazo final e o tempo para contraproposta dos fornecedores.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="deadline-date">Data Limite</Label>
                    <Popover>
                          <PopoverTrigger asChild>
                              <Button variant="outline" id="deadline-date" className="w-full justify-start text-left font-normal">
                                  <IconCalendar className="mr-2 h-4 w-4" />
                                  {deadlineDate ? format(deadlineDate, "dd/MM/yyyy") : <span>Escolha a data</span>}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                              <Calendar mode="single" selected={deadlineDate} onSelect={setDeadlineDate} initialFocus locale={ptBR} />
                          </PopoverContent>
                      </Popover>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="deadline-time">Horário Limite</Label>
                    <Input type="time" id="deadline-time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} />
                </div>
            </div>

            <div className="space-y-1">
                <Label htmlFor="counter-offer-time" className="flex items-center gap-1.5"><Timer className="h-4 w-4" /> Tempo para Contraproposta (minutos)</Label>
                <Input 
                    id="counter-offer-time" 
                    type="number" 
                    placeholder="Ex: 15" 
                    value={counterOfferTime}
                    onChange={(e) => setCounterOfferTime(e.target.value)}
                />
            </div>
            
            <div className="space-y-1">
                <Label htmlFor="reminder-percentage" className="flex items-center gap-1.5"><Bell className="h-4 w-4" /> Lembrete de Contraproposta (%)</Label>
                <Input 
                    id="reminder-percentage" 
                    type="number" 
                    placeholder="Ex: 50" 
                    value={reminderPercentage}
                    onChange={(e) => setReminderPercentage(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">Envia lembrete quando faltar X% do tempo. 0 para desativar.</p>
            </div>

             <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
                <div className="flex items-start gap-3">
                    <UserCheck className="h-6 w-6 text-primary mt-1" />
                    <div>
                        <h4 className="font-semibold text-primary">{selectedSupplierIds.length} Fornecedor(es) Selecionado(s)</h4>
                        <p className="text-sm text-primary/80">
                            Eles receberão uma notificação via WhatsApp para participar.
                        </p>
                    </div>
                </div>
            </div>
        </CardContent>
        <CardFooter>
            <Button 
                className="w-full text-lg py-6"
                onClick={handleStartQuotation}
                disabled={isStartingQuotation || selectedSupplierIds.length === 0 || !deadlineDate}
            >
                {isStartingQuotation ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <Send className="mr-2 h-5 w-5"/>}
                {isStartingQuotation ? 'Iniciando Cotação...' : 'Iniciar Cotação e Notificar'}
            </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
