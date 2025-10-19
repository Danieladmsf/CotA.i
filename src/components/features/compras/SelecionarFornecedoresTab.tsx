
"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from '@/hooks/use-toast';
import { useOptimizedSuppliers } from '@/hooks/useOptimizedSuppliers';
import type { Fornecedor, Quotation } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, Send, Calendar as IconCalendar, UserCheck, AlertTriangle, Timer, Bell, Lock, Info } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { startQuotation, updateQuotation } from '@/actions/quotationActions';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';

const FORNECEDORES_COLLECTION = 'fornecedores';

interface SelecionarFornecedoresTabProps {
  shoppingListDate: Date | null;
  listId: string | null;
  onQuotationStarted: () => void;
  selectedQuotationId?: string | null;
  quotationStatus?: string | null;
  hasActiveQuotation?: boolean;
  onTabChange?: (tab: string) => void;
}

export default function SelecionarFornecedoresTab({
  shoppingListDate,
  listId,
  onQuotationStarted,
  selectedQuotationId,
  quotationStatus,
  hasActiveQuotation,
  onTabChange
}: SelecionarFornecedoresTabProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab') || 'criar-editar';

  const isReadOnly = useMemo(() => quotationStatus === 'Fechada' || quotationStatus === 'Concluída', [quotationStatus]);

  // Usar o hook otimizado para carregar fornecedores
  const { 
    suppliers: allSuppliers, 
    isLoading: isLoadingSuppliers, 
    error: suppliersError,
    refetch: refetchSuppliers,
    clearCache: clearSuppliersCache
  } = useOptimizedSuppliers(user?.uid || null);

  const [selectedSuppliers, setSelectedSuppliers] = useState<Record<string, boolean>>({});
  const [originalSupplierIds, setOriginalSupplierIds] = useState<string[]>([]); // Track original suppliers in active quotation
  const [isStartingQuotation, setIsStartingQuotation] = useState(false);

  const [deadlineDate, setDeadlineDate] = useState<Date | undefined>(new Date());
  const [deadlineTime, setDeadlineTime] = useState<string>(() => {
    const now = new Date();
    now.setHours(now.getHours() + 1);
    return now.toTimeString().slice(0, 5);
  });
  const [counterOfferTime, setCounterOfferTime] = useState('15');
  const [reminderPercentage, setReminderPercentage] = useState('50');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
  const [existingActiveQuotation, setExistingActiveQuotation] = useState<Quotation | null>(null);

  // Ref to track if warning has been shown for current quotation to prevent repeated displays
  // Store Set of quotation IDs that have already shown the warning
  // Use sessionStorage to persist across component unmount/remount within the same session
  const hasShownWarningRef = useRef<Set<string>>(new Set());

  // Initialize from sessionStorage on mount
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('hasShownQuotationWarning');

      if (stored) {
        const parsed = JSON.parse(stored);
        hasShownWarningRef.current = new Set(parsed);
      } else {
      }
    } catch (error) {
      console.error('❌ [SelecionarFornecedoresTab] Failed to load from sessionStorage:', error);
    }
  }, []); // Run only once on mount

  useEffect(() => {

    if (!user || (!listId && !selectedQuotationId)) {
      return;
    }

    const collectionRef = collection(db, 'quotations');
    let q;

    if (selectedQuotationId) {
      // If a specific quotation is selected, fetch it directly
      q = query(collectionRef, where('__name__', '==', selectedQuotationId), where('userId', '==', user.uid));
    } else if (listId) {
      // Otherwise, look for an active quotation for the given listId
      q = query(collectionRef, where('listId', '==', listId), where('userId', '==', user.uid), where('status', 'in', ['Aberta', 'Pausada']));
    } else {
      return;
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {

      if (!snapshot.empty) {
        const quotationData = snapshot.docs[0].data() as Quotation;
        const quotation = { ...quotationData, id: snapshot.docs[0].id };


        setExistingActiveQuotation(quotation);

        if (quotation.supplierIds && quotation.supplierIds.length > 0) {
          const preselectedSuppliers = quotation.supplierIds.reduce((acc: Record<string, boolean>, id: string) => {
            acc[id] = true;
            return acc;
          }, {} as Record<string, boolean>);
          setSelectedSuppliers(preselectedSuppliers);

          // Store original supplier IDs for locking when quotation is active
          setOriginalSupplierIds(quotation.supplierIds);
        }

        if (quotation.deadline) {
            const deadline = (quotation.deadline as any).toDate();
            setDeadlineDate(deadline);
            setDeadlineTime(format(deadline, 'HH:mm'));
        }

        if (quotation.counterProposalTimeInMinutes) {
            setCounterOfferTime(String(quotation.counterProposalTimeInMinutes));
        }

        if (quotation.counterProposalReminderPercentage) {
            setReminderPercentage(String(quotation.counterProposalReminderPercentage));
        }

        // Only show warning modal if:
        // 1. The quotation is ACTIVE (Aberta or Pausada) - situação ROXA
        // 2. We are editing an existing quotation (selectedQuotationId exists)
        // 3. We haven't shown the warning for this quotation yet (check Set)
        // 4. User is adding items to an active quotation (coming back to step 2)
        const quotationId = quotation.id;
        const hasAlreadyShown = hasShownWarningRef.current.has(quotationId);

        const isActive = quotation.status === 'Aberta' || quotation.status === 'Pausada';
        const hasSelectedQuotation = selectedQuotationId !== null && selectedQuotationId !== 'nova-cotacao';
        const isSameQuotation = selectedQuotationId === quotationId;


        // CRITICAL: Only show modal if we are on the "iniciar-cotacao" tab
        // This prevents modal from showing when navigating TO gestao tab after creating quotation
        const isOnCorrectTab = currentTab === 'iniciar-cotacao';

        const shouldShowWarning =
          isActive &&
          !isReadOnly &&
          !hasAlreadyShown &&
          hasSelectedQuotation &&
          isSameQuotation &&
          isOnCorrectTab; // Only show when ON the iniciar-cotacao tab

        if (shouldShowWarning) {
            setIsWarningModalOpen(true);
            hasShownWarningRef.current.add(quotationId); // Add to Set so it won't show again

            // Persist to sessionStorage to survive component unmount/remount
            try {
              const arrayToSave = Array.from(hasShownWarningRef.current);
              const jsonString = JSON.stringify(arrayToSave);
              sessionStorage.setItem('hasShownQuotationWarning', jsonString);

              // Verify it was saved
              const verification = sessionStorage.getItem('hasShownQuotationWarning');
            } catch (error) {
              console.error('❌ [SelecionarFornecedoresTab] Failed to save to sessionStorage:', error);
            }

        } else if (!isOnCorrectTab) {
        } else if (isActive && hasAlreadyShown) {
        } else if (isActive && !hasSelectedQuotation) {
        } else if (isActive && !isSameQuotation) {
        } else if (!isActive) {
        } else if (isReadOnly) {
        }

      } else {
        setExistingActiveQuotation(null);
        setSelectedSuppliers({});
        setOriginalSupplierIds([]);
      }
    });

    return () => unsubscribe();
  }, [listId, selectedQuotationId, user, isReadOnly, currentTab]); // Added currentTab to re-evaluate modal logic when tab changes

  // Mostrar toast de erro se houver problema ao carregar fornecedores
  useEffect(() => {
    if (suppliersError) {
      toast({
        title: "Erro ao carregar fornecedores",
        description: suppliersError,
        variant: "destructive",
        duration: 8000
      });
    }
  }, [suppliersError, toast]);

  const handleSupplierSelection = (supplierId: string, checked: boolean) => {
    // Prevent deselecting original suppliers when quotation is active
    if (hasActiveQuotation && originalSupplierIds.includes(supplierId) && !checked) {
      toast({
        title: "Fornecedor bloqueado",
        description: "Não é possível remover fornecedores já participantes da cotação em andamento.",
        variant: "destructive"
      });
      return;
    }
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
      let result;
      if (existingActiveQuotation) {
        // Update existing quotation
        result = await updateQuotation(
          existingActiveQuotation.id,
          listId,
          shoppingListDate.toISOString(),
          selectedSupplierIds,
          finalDeadline.toISOString(),
          timeValue,
          reminderValue,
          formattedDeadlineForMessage,
          user.uid
        );
      } else {
        // Start new quotation
        result = await startQuotation(
          listId,
          shoppingListDate.toISOString(),
          selectedSupplierIds,
          finalDeadline.toISOString(),
          timeValue,
          reminderValue,
          formattedDeadlineForMessage,
          user.uid
        );
      }

      if (!result.success) {
        throw new Error(result.error || "Ocorreu um erro desconhecido no servidor.");
      }

      toast({
        title: existingActiveQuotation ? "Cotação Atualizada!" : "Cotação Iniciada!",
        description: `Convites enviados para ${selectedSupplierIds.length} fornecedor(es). Redirecionando...`,
      });

      onQuotationStarted();

    } catch (error: any) {
      toast({ title: "Erro ao iniciar cotação", description: error.message, variant: "destructive" });
    } finally {
      setIsStartingQuotation(false);
    }
  };

  // Auto-redirect to step 1 if no list or nova-cotacao
  // BUT: Don't redirect if user just saved a list (listId exists)
  useEffect(() => {
    const shouldRedirect = (!shoppingListDate || selectedQuotationId === 'nova-cotacao') && !listId;

    if (shouldRedirect && onTabChange) {
      onTabChange('criar-editar');
      toast({
        title: "Redirecionado para Passo 1",
        description: "Configure a lista de compras antes de selecionar fornecedores.",
        variant: "default"
      });
    }
  }, [shoppingListDate, selectedQuotationId, listId, onTabChange, toast]);

  // Return loading state while redirecting (but not if listId exists - user just saved)
  if ((!shoppingListDate || selectedQuotationId === 'nova-cotacao') && !listId) {
    return (
        <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
                <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
                <p className="text-lg font-semibold text-foreground">Redirecionando para Passo 1...</p>
                <p className="text-muted-foreground mt-2">
                    Configure a lista de compras primeiro.
                </p>
            </CardContent>
        </Card>
    );
  }


  return (
    <>
      <Dialog
        open={isWarningModalOpen}
        onOpenChange={(open) => {
          setIsWarningModalOpen(open);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cotação em Andamento Detectada</DialogTitle>
            <DialogDescription>
              Existe uma cotação ativa para esta lista de compras. Você pode adicionar novos fornecedores, ajustar os prazos ou atualizar os itens antes de prosseguir.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => {
              setIsWarningModalOpen(false);
            }}>Entendi</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {hasActiveQuotation && (
        <div className="flex items-start gap-3 p-3 mb-6 bg-purple-50 border border-purple-200 rounded-lg">
          <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-purple-800">
            <strong>Cotação em andamento:</strong> Adicione novos fornecedores conforme necessário.
            Fornecedores já participantes estão bloqueados e não podem ser removidos.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card className={isReadOnly ? 'bg-gray-50' : ''}>
        <CardHeader>
          <CardTitle>Selecionar Fornecedores</CardTitle>
          <CardDescription>
            {isReadOnly
              ? `Visualizando fornecedores da cotação de ${shoppingListDate ? format(shoppingListDate, "dd/MM/yyyy") : ''}.`
              : `Marque os fornecedores que participarão da cotação para a lista de ${shoppingListDate ? format(shoppingListDate, "dd/MM/yyyy") : ''}.`
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[500px] overflow-y-auto">
          {isReadOnly && (
            <div className="mb-4 p-3 bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700">
              <p className="font-bold">Modo de Consulta</p>
              <p>Esta cotação está encerrada. Apenas visualização é permitida.</p>
            </div>
          )}

          
          {isLoadingSuppliers ? (
            <div className="flex items-center justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : allSuppliers.length === 0 ? (
             <p className="text-muted-foreground text-center p-4">Nenhum fornecedor ativo encontrado. Cadastre um na página &quot;Fornecedores&quot;.</p>
          ) : (
            <div>
              <div className="flex items-center space-x-2 pb-4 border-b mb-4">
                <Checkbox
                  id="select-all-suppliers"
                  checked={allSuppliers.length > 0 && selectedSupplierIds.length === allSuppliers.length}
                  disabled={isReadOnly}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      // Select all
                      const allIds = allSuppliers.reduce((acc, supplier) => {
                        acc[supplier.id] = true;
                        return acc;
                      }, {} as Record<string, boolean>);
                      setSelectedSuppliers(allIds);
                    } else {
                      // Deselect all, but keep original suppliers if quotation is active
                      if (hasActiveQuotation && originalSupplierIds.length > 0) {
                        const keepOriginals = originalSupplierIds.reduce((acc, id) => {
                          acc[id] = true;
                          return acc;
                        }, {} as Record<string, boolean>);
                        setSelectedSuppliers(keepOriginals);
                      } else {
                        setSelectedSuppliers({});
                      }
                    }
                  }}
                />
                <label
                  htmlFor="select-all-suppliers"
                  className="text-sm font-medium leading-none"
                >
                  Selecionar Todos / Desmarcar Todos
                </label>
              </div>
              <div className="space-y-3 mt-4">
                {allSuppliers.map(supplier => {
                  const isOriginalSupplier = hasActiveQuotation && originalSupplierIds.includes(supplier.id);
                  const isLocked = isOriginalSupplier || isReadOnly;

                  return (
                    <label
                      key={supplier.id}
                      htmlFor={`supplier-${supplier.id}`}
                      className={`flex items-center gap-4 p-3 border rounded-lg transition-colors ${
                        isReadOnly ? 'cursor-not-allowed bg-gray-100' :
                        isOriginalSupplier ? 'cursor-not-allowed bg-purple-50 border-purple-300' :
                        'hover:bg-muted/50 cursor-pointer'
                      }`}
                    >
                      <Checkbox
                        id={`supplier-${supplier.id}`}
                        checked={!!selectedSuppliers[supplier.id]}
                        onCheckedChange={(checked) => handleSupplierSelection(supplier.id, !!checked)}
                        disabled={isLocked}
                      />
                      <div className="relative w-10 h-10">
                        <Image
                          src={supplier.fotoUrl && (supplier.fotoUrl.startsWith('http') || supplier.fotoUrl.startsWith('data:')) ? supplier.fotoUrl : 'https://placehold.co/40x40.png'}
                          alt={supplier.empresa}
                          fill
                          className="rounded-full object-cover"
                          data-ai-hint={supplier.fotoHint}
                          sizes="40px"
                        />
                      </div>
                      <div className="flex-grow">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold">{supplier.empresa}</p>
                          {isOriginalSupplier && (
                            <Badge variant="secondary" className="text-xs bg-purple-200 text-purple-800 border-purple-300">
                              <Lock className="h-3 w-3 mr-1" />
                              Participando
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{supplier.vendedor}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className={`sticky top-6 ${isReadOnly ? 'bg-gray-50' : ''}`}>
        <CardHeader>
            <CardTitle>Definir Prazos e Iniciar</CardTitle>
            <CardDescription>
              {isReadOnly 
                ? "Visualizando os prazos definidos para esta cotação."
                : "Defina o prazo final e o tempo para contraproposta dos fornecedores."
              }
            </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                    <Label htmlFor="deadline-date">Data Limite</Label>
                    <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                          <PopoverTrigger asChild>
                              <Button variant="outline" id="deadline-date" className="w-full justify-start text-left font-normal" disabled={isReadOnly}>
                                  <IconCalendar className="mr-2 h-4 w-4" />
                                  {deadlineDate ? format(deadlineDate, "dd/MM/yyyy") : <span>Escolha a data</span>}
                              </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                              <Calendar 
                                mode="single" 
                                selected={deadlineDate} 
                                onSelect={(date) => {
                                  setDeadlineDate(date);
                                  setIsCalendarOpen(false);
                                }} 
                                initialFocus 
                                locale={ptBR} 
                                disabled={isReadOnly}
                              />
                          </PopoverContent>
                      </Popover>
                </div>
                <div className="space-y-1">
                    <Label htmlFor="deadline-time">Horário Limite</Label>
                    <Input type="time" id="deadline-time" value={deadlineTime} onChange={(e) => setDeadlineTime(e.target.value)} disabled={isReadOnly} />
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
                    disabled={isReadOnly}
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
                    disabled={isReadOnly}
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
                disabled={isStartingQuotation || selectedSupplierIds.length === 0 || !deadlineDate || isReadOnly}
            >
                {isReadOnly ? (
                    <><Lock className="mr-2 h-5 w-5"/> Cotação Encerrada (Apenas Visualização)</>
                ) : isStartingQuotation ? (
                    <><Loader2 className="mr-2 h-5 w-5 animate-spin"/> Iniciando Cotação...</>
                ) : (
                    <><Send className="mr-2 h-5 w-5"/> Iniciar Cotação e Notificar</>
                )}
            </Button>
        </CardFooter>
      </Card>
          </div>
        </>
      );}
