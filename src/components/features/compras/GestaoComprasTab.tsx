"use client";

import * as React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, Timestamp, doc, updateDoc } from 'firebase/firestore';
import type { ShoppingListItem, Quotation } from '@/types';

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";

import {
    Search,
    Loader2,
    PauseCircle,
    PlayCircle,
    FileBarChart,
    Calendar as IconCalendar
} from 'lucide-react';

const QUOTATIONS_COLLECTION = 'quotations';
const SHOPPING_LIST_ITEMS_COLLECTION = 'shopping_list_items';

interface GestaoComprasTabProps {
  selectedQuotationId: string | null;
  onTabChange?: (tab: string) => void;
}

export default function GestaoComprasTab({ selectedQuotationId, onTabChange }: GestaoComprasTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [activeQuotation, setActiveQuotation] = useState<Quotation | null>(null);
  const [shoppingListItems, setShoppingListItems] = useState<ShoppingListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos-status");

  const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
  const [quotationToResume, setQuotationToResume] = useState<Quotation | null>(null);
  const [newDeadlineDate, setNewDeadlineDate] = useState<Date | undefined>();
  const [newDeadlineTime, setNewDeadlineTime] = useState("17:00");

  // Fetch the selected quotation
  useEffect(() => {
    if (!selectedQuotationId || !user) {
      setActiveQuotation(null);
      setShoppingListItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const qQuotation = query(
      collection(db, QUOTATIONS_COLLECTION),
      where("userId", "==", user.uid)
    );

    const unsubscribeQuotation = onSnapshot(qQuotation, (snapshot) => {
      const fetchedQuotations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      const found = fetchedQuotations.find(q => q.id === selectedQuotationId);
      setActiveQuotation(found || null);
    }, (error) => {
      console.error("Error fetching quotation:", error);
      toast({ title: "Erro ao carregar cotação", description: error.message, variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribeQuotation();
  }, [selectedQuotationId, user, toast]);

  useEffect(() => {
    if (!activeQuotation) {
      setShoppingListItems([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const qItems = query(
      collection(db, SHOPPING_LIST_ITEMS_COLLECTION),
      where("quotationId", "==", activeQuotation.id)
    );

    const unsubscribe = onSnapshot(qItems, (snapshot) => {
      const fetchedItems = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ShoppingListItem));
      setShoppingListItems(fetchedItems);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching items for quotation:", error);
      toast({ title: "Erro ao carregar itens da cotação", description: error.message, variant: "destructive" });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [activeQuotation, toast]);

  const handlePauseToggle = async () => {
    if (!activeQuotation) return;
    
    if (activeQuotation.status === 'Pausada') {
      setQuotationToResume(activeQuotation);
      setNewDeadlineDate(activeQuotation.deadline.toDate());
      setNewDeadlineTime(format(activeQuotation.deadline.toDate(), 'HH:mm'));
      setIsResumeModalOpen(true);
    } else {
      try {
        await updateDoc(doc(db, QUOTATIONS_COLLECTION, activeQuotation.id), { status: 'Pausada' });
        toast({ title: "Cotação Pausada", description: "Os fornecedores não poderão enviar novas ofertas." });
      } catch (error: any) {
        toast({ title: "Erro ao pausar", description: error.message, variant: "destructive" });
      }
    }
  };

  const handleConfirmResume = async () => {
    if (!quotationToResume || !newDeadlineDate) return;
    
    const [hours, minutes] = newDeadlineTime.split(':').map(Number);
    const finalDeadline = new Date(newDeadlineDate);
    finalDeadline.setHours(hours, minutes, 0, 0);

    if (finalDeadline < new Date()) {
      toast({ title: "Data Inválida", description: "O novo prazo não pode ser no passado.", variant: "destructive" });
      return;
    }
    
    try {
      await updateDoc(doc(db, QUOTATIONS_COLLECTION, quotationToResume.id), {
        status: 'Aberta',
        deadline: Timestamp.fromDate(finalDeadline)
      });
      toast({ title: "Cotação Retomada!", description: `Novo prazo: ${format(finalDeadline, "dd/MM/yyyy HH:mm")}.` });
      setIsResumeModalOpen(false);
    } catch (error: any) {
      toast({ title: "Erro ao retomar", description: error.message, variant: "destructive" });
    }
  };
  
  const itemsToDisplay = useMemo(() => {
    return shoppingListItems.filter(item => {
      const searchTermMatch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const statusMatch = statusFilter === 'todos-status' || item.status === statusFilter;
      return searchTermMatch && statusMatch;
    }).sort((a,b) => a.name.localeCompare(b.name));
  }, [shoppingListItems, searchTerm, statusFilter]);

  const getStatusBadgeVariant = (status: ShoppingListItem['status']): "default" | "secondary" | "destructive" | "outline" | "success" => {
    switch (status) {
      case 'Comprado': return 'default';
      case 'Pendente': return 'outline';
      case 'Cotado': return 'success';
      case 'Recebido': return 'secondary';
      case 'Cancelado': return 'destructive';
      case 'Encerrado': return 'destructive';
      default: return 'secondary';
    }
  };

  // Auto-redirect to step 1 if no quotation or nova-cotacao
  React.useEffect(() => {
    const shouldRedirect = !selectedQuotationId || selectedQuotationId === 'nova-cotacao';

    if (shouldRedirect && onTabChange) {
      onTabChange('criar-editar');
      toast({
        title: "Redirecionado para Passo 1",
        description: "Inicie uma cotação primeiro para gerenciar as compras.",
        variant: "default"
      });
    }
  }, [selectedQuotationId, onTabChange, toast]);

  // Return loading state while redirecting
  if (!selectedQuotationId || selectedQuotationId === 'nova-cotacao') {
    return (
      <Card>
        <CardContent className="p-6 flex flex-col items-center justify-center text-center h-full min-h-[400px]">
          <Loader2 className="h-12 w-12 animate-spin text-blue-500 mb-4" />
          <p className="text-lg font-semibold text-foreground">Redirecionando para Passo 1...</p>
          <p className="text-muted-foreground mt-2">
            Inicie uma cotação primeiro.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex-wrap !flex-row gap-4 justify-between items-center">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar item..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-8 w-full sm:w-[250px]" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos-status">Todos</SelectItem>
                <SelectItem value="Pendente">Pendente</SelectItem>
                <SelectItem value="Cotado">Cotado</SelectItem>
                <SelectItem value="Comprado">Comprado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0 space-y-6">
          {isLoading ? (
            <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : (
            <>
              {activeQuotation && (
                <Alert variant={activeQuotation.status === 'Aberta' ? 'default' : 'destructive'} className="bg-blue-100 border-blue-300 text-blue-800 p-4 rounded-lg">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center w-full gap-2">
                    <div>
                      <AlertTitle className="text-lg font-bold text-blue-900">{`Cotação ${activeQuotation.status}`}</AlertTitle>
                      <p className="text-md text-blue-800">Prazo: {format(activeQuotation.deadline.toDate(), "dd/MM/yyyy HH:mm")}</p>
                    </div>
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      {(activeQuotation.status === 'Aberta' || activeQuotation.status === 'Pausada') && (
                        <Button onClick={handlePauseToggle} variant="secondary" size="sm">
                          {activeQuotation.status === 'Pausada' ? <PlayCircle className="mr-2 h-4 w-4" /> : <PauseCircle className="mr-2 h-4 w-4" />}
                          {activeQuotation.status === 'Pausada' ? 'Retomar' : 'Pausar'}
                        </Button>
                      )}
                      <Button onClick={() => router.push(`/cotacao?quotationId=${activeQuotation.id}`)} variant="outline" size="sm">
                        <FileBarChart className="mr-2 h-4 w-4" /> Ver Análise
                      </Button>
                    </div>
                  </div>
                </Alert>
              )}
              <div className="rounded-md border">
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Qtd./Unid.</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Marcas</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {itemsToDisplay.length > 0 ? (
                      itemsToDisplay.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell><Badge variant={getStatusBadgeVariant(item.status)}>{item.status === 'Cotado' ? 'Cotando' : item.status}</Badge></TableCell>
                          <TableCell>{`${item.quantity} ${item.unit}`}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>{item.preferredBrands || "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">Nenhum item encontrado.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isResumeModalOpen} onOpenChange={setIsResumeModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Retomar Cotação</DialogTitle>
            <DialogDescription>Ajuste o prazo final para os fornecedores.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Nova Data Limite</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal mt-1">
                      <IconCalendar className="mr-2 h-4 w-4" />
                      {newDeadlineDate ? format(newDeadlineDate, "dd/MM/yyyy") : <span>Escolha a data</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={newDeadlineDate} onSelect={setNewDeadlineDate} initialFocus locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium">Novo Horário Limite</label>
                <Input type="time" value={newDeadlineTime} onChange={(e) => setNewDeadlineTime(e.target.value)} className="mt-1" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild><Button variant="outline">Cancelar</Button></DialogClose>
            <Button onClick={handleConfirmResume}>Confirmar e Retomar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}