
"use client";

import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GestaoComprasTab from "@/components/features/compras/GestaoComprasTab";
import NewShoppingListClient from "@/components/features/compras/NewShoppingListClient";
import SelecionarFornecedoresTab from "@/components/features/compras/SelecionarFornecedoresTab";
import { ShoppingCart, ListPlus, Users, Loader2 } from "lucide-react";
import { parseISO, isValid, format } from 'date-fns';

export default function ComprasPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [activeTab, setActiveTab] = useState("criar-editar");
  const [currentDate, setCurrentDate] = useState<Date | undefined>(undefined);
  const [listDateForQuotation, setListDateForQuotation] = useState<Date | null>(null);
  const [listIdForQuotation, setListIdForQuotation] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);

  const handleTabChange = useCallback((value: string, date?: Date, listId?: string) => {
    setActiveTab(value);
    const params = new URLSearchParams(window.location.search);
    params.set('tab', value);
    
    if (date) {
      params.set('date', format(date, 'yyyy-MM-dd'));
    } else {
      params.delete('date');
    }

    if (listId) {
        params.set('listId', listId);
    } else {
        params.delete('listId');
    }

    if (params.has('quotationId')) {
        params.delete('quotationId');
    }
    router.replace(`/compras?${params.toString()}`, { scroll: false });
  }, [router]);
  
  useEffect(() => {
    const tab = searchParams.get('tab') || 'criar-editar';
    const dateStr = searchParams.get('date');
    const listIdStr = searchParams.get('listId');
    
    setActiveTab(tab);

    if (tab === 'iniciar-cotacao' && dateStr && listIdStr) {
        const parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            setListDateForQuotation(parsedDate);
            setListIdForQuotation(listIdStr);
        } else {
            setListDateForQuotation(null);
            setListIdForQuotation(null);
        }
    } else {
        setListDateForQuotation(null);
        setListIdForQuotation(null);
    }
    
    setCurrentDate(prevDate => prevDate || new Date());
    setIsLoading(false);
    
  }, [searchParams]);
  
  const handleListSaved = (listId: string, date: Date) => {
    setListDateForQuotation(date);
    setListIdForQuotation(listId);
    handleTabChange('iniciar-cotacao', date, listId);
  };

  const handleQuotationStarted = () => {
    handleTabChange('gestao');
  };

  const handleDateChangeForList = (newDate: Date) => {
      setCurrentDate(newDate);
      if(activeTab === 'iniciar-cotacao') {
          handleTabChange('iniciar-cotacao', newDate, listIdForQuotation ?? undefined);
      }
  }

  if (isLoading || !currentDate) {
    return (
      <div className="flex w-full items-center justify-center p-8 min-h-[calc(100vh-200px)]">
        <div className="flex flex-col items-center gap-4 rounded-xl bg-card p-10 shadow-xl border">
          <Loader2 className="h-12 w-12 animate-spin text-primary pulse-glow" />
          <p className="text-lg text-muted-foreground">Carregando sistema...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="space-y-8" role="main">
      <header className="fade-in">
        <h1 className="text-5xl font-heading font-bold text-gradient mb-3">
          Sistema de Compras
        </h1>
        <p className="text-muted-foreground text-xl font-medium">
          Gerencie suas listas de compras e cotações de forma eficiente e inteligente
        </p>
      </header>
        
      <section className="w-full" aria-labelledby="compras-tabs">
        <Tabs value={activeTab} onValueChange={(tab) => handleTabChange(tab, listDateForQuotation ?? currentDate, listIdForQuotation ?? undefined)} className="w-full">
          <TabsList className="grid w-full grid-cols-1 sm:grid-cols-3 h-auto modern-shadow-lg card-professional p-2" role="tablist" aria-label="Etapas do processo de compras">
            <TabsTrigger 
              value="criar-editar" 
              className="py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base"
              role="tab"
              aria-selected={activeTab === "criar-editar"}
            >
              <ListPlus className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span>Passo 1: Criar Lista</span>
            </TabsTrigger>
            <TabsTrigger 
              value="iniciar-cotacao" 
              className="py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base" 
              disabled={!listDateForQuotation && activeTab !== 'iniciar-cotacao'}
              role="tab"
              aria-selected={activeTab === "iniciar-cotacao"}
            >
              <Users className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span>Passo 2: Iniciar Cotação</span>
            </TabsTrigger>
            <TabsTrigger 
              value="gestao" 
              className="py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base"
              role="tab"
              aria-selected={activeTab === "gestao"}
            >
              <ShoppingCart className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span>Gestão de Cotações</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar-editar" className="mt-8 bounce-in" role="tabpanel" aria-labelledby="criar-editar-tab">
            <NewShoppingListClient selectedDate={currentDate} onDateChange={handleDateChangeForList} onListSaved={handleListSaved} />
          </TabsContent>

          <TabsContent value="iniciar-cotacao" className="mt-8 bounce-in" role="tabpanel" aria-labelledby="iniciar-cotacao-tab">
            <SelecionarFornecedoresTab 
              shoppingListDate={listDateForQuotation} 
              listId={listIdForQuotation}
              onQuotationStarted={handleQuotationStarted}
            />
          </TabsContent>
          
          <TabsContent value="gestao" className="mt-8 bounce-in" role="tabpanel" aria-labelledby="gestao-tab">
            <GestaoComprasTab selectedDate={currentDate} onDateChange={setCurrentDate} />
          </TabsContent>

        </Tabs>
      </section>
    </main>
  );
}
