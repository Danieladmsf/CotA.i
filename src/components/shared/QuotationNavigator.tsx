"use client";

import * as React from "react";
import { useMemo } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, isSameDay } from 'date-fns';
import type { Quotation } from '@/types';

interface QuotationNavigatorProps {
  // Dados
  allQuotations: Quotation[];
  filteredQuotations: Quotation[];
  selectedDate?: Date;
  selectedQuotationId: string | null;

  // Array usado para navegação com setas (pode ser diferente de allQuotations)
  // Por exemplo, em Compras usa navigableQuotations que inclui "nova-cotacao" virtual
  navigableQuotations?: Quotation[];

  // Estados de loading
  isLoading?: boolean;

  // Callbacks
  onDateChange: (date: Date | undefined) => void;
  onQuotationSelect: (id: string) => void;

  // Configurações opcionais
  showBadgeInfo?: boolean;
  timeLeft?: string;
  isDeadlinePassed?: boolean;
  isQuotationPaused?: boolean;
  enableNavigationLoop?: boolean; // Se true, permite loop circular na navegação
  updateDateOnNavigate?: boolean; // Se true, atualiza a data ao navegar (padrão: true)

  // Customização
  className?: string;
  showDateFilter?: boolean;
  inline?: boolean; // Se true, renderiza apenas o conteúdo sem section/card wrapper
}

export default function QuotationNavigator({
  allQuotations,
  filteredQuotations,
  navigableQuotations,
  selectedDate,
  selectedQuotationId,
  isLoading = false,
  onDateChange,
  onQuotationSelect,
  showBadgeInfo = true,
  timeLeft,
  isDeadlinePassed = false,
  isQuotationPaused = false,
  enableNavigationLoop = false,
  updateDateOnNavigate = true,
  className = "",
  showDateFilter = true,
  inline = false,
}: QuotationNavigatorProps) {

  // Array usado para navegação (por padrão, usa allQuotations)
  const quotationsForNavigation = navigableQuotations || allQuotations;

  // Função interna de navegação
  const handleNavigate = (direction: 'prev' | 'next') => {
    if (quotationsForNavigation.length === 0) return;

    let currentIndex = quotationsForNavigation.findIndex(q => q.id === selectedQuotationId);

    // Se nenhuma cotação está selecionada, começar do início ou fim
    if (currentIndex === -1) {
      currentIndex = direction === 'prev' ? 0 : -1;
    }

    let nextIndex = -1;

    // NAVEGAÇÃO CRONOLÓGICA:
    // Array está ordenado: [0] = mais recente → [n] = mais antiga
    // prev (⮜) = retroceder no tempo = índice MAIOR (cotações mais antigas)
    // next (⮞) = avançar no tempo = índice MENOR (cotações mais recentes)

    if (direction === 'prev') {
      // Retroceder no tempo = avançar no array (índice maior)
      if (enableNavigationLoop) {
        nextIndex = currentIndex < quotationsForNavigation.length - 1 ? currentIndex + 1 : 0;
      } else {
        nextIndex = currentIndex < quotationsForNavigation.length - 1 ? currentIndex + 1 : -1;
      }
    } else {
      // Avançar no tempo = retroceder no array (índice menor)
      if (enableNavigationLoop) {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : quotationsForNavigation.length - 1;
      } else {
        nextIndex = currentIndex > 0 ? currentIndex - 1 : -1;
      }
    }

    if (nextIndex !== -1 && quotationsForNavigation[nextIndex]) {
      const nextQuotation = quotationsForNavigation[nextIndex];

      // CRITICAL: Atualizar cotação selecionada ANTES da data
      // Isso previne que o auto-select baseado na data selecione a cotação errada
      onQuotationSelect(nextQuotation.id);

      // Atualizar data se configurado
      if (updateDateOnNavigate && nextQuotation.shoppingListDate) {
        onDateChange(nextQuotation.shoppingListDate.toDate());
      }
    }
  };

  // Verificar se pode navegar
  // prev (⮜) = retroceder no tempo = ir para cotações mais antigas (índice maior)
  // next (⮞) = avançar no tempo = ir para cotações mais recentes (índice menor)
  const canNavigatePrev = useMemo(() => {
    if (quotationsForNavigation.length < 2) return false;
    if (enableNavigationLoop) return true;

    // Sem loop: pode retroceder se não está no final (cotação mais antiga)
    const currentIndex = quotationsForNavigation.findIndex(q => q.id === selectedQuotationId);
    return currentIndex !== -1 && currentIndex < quotationsForNavigation.length - 1;
  }, [quotationsForNavigation, selectedQuotationId, enableNavigationLoop]);

  const canNavigateNext = useMemo(() => {
    if (quotationsForNavigation.length < 2) return false;
    if (enableNavigationLoop) return true;

    // Sem loop: pode avançar se não está no início (cotação mais recente)
    const currentIndex = quotationsForNavigation.findIndex(q => q.id === selectedQuotationId);
    return currentIndex > 0;
  }, [quotationsForNavigation, selectedQuotationId, enableNavigationLoop]);

  // Conteúdo da navegação (sem wrapper)
  const navigationContent = (
    <div className={`flex flex-wrap items-center gap-3 ${inline ? 'justify-start' : 'justify-center'}`}>
            {showDateFilter && (
              <div className="relative">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="hover-lift text-sm">
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Filtrar por Data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar mode="single" selected={selectedDate} onSelect={onDateChange} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate('prev')}
                disabled={!canNavigatePrev || isLoading}
                className="hover-lift"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>

              <Select
                value={selectedQuotationId || ""}
                onValueChange={(value) => {
                  // Ao selecionar do dropdown, garantir que seleciona primeiro
                  onQuotationSelect(value);

                  // Depois atualizar a data se necessário
                  if (updateDateOnNavigate) {
                    const selectedQuotation = filteredQuotations.find(q => q.id === value);
                    if (selectedQuotation?.shoppingListDate) {
                      onDateChange(selectedQuotation.shoppingListDate.toDate());
                    }
                  }
                }}
                disabled={isLoading || filteredQuotations.length === 0}
              >
                <SelectTrigger className="flex-1 input-modern text-sm min-w-[250px]">
                  <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione uma Cotação"}>
                    {selectedQuotationId && (() => {
                      const selected = filteredQuotations.find(q => q.id === selectedQuotationId);
                      if (!selected) return "Selecione uma Cotação";

                      // Handle virtual "nova-cotacao"
                      if (selected.id === 'nova-cotacao') {
                        // Número sequencial global = total de cotações + 1
                        const nextNumber = allQuotations.length + 1;
                        return `Nova cotação nº ${nextNumber} de ${format(selected.shoppingListDate.toDate(), "dd/MM/yy")}`;
                      }

                      // Handle regular quotations - número sequencial global
                      const sortedAllQuotations = [...allQuotations].sort((a,b) => {
                        const aTime = a.createdAt && (a.createdAt as any).toMillis ? (a.createdAt as any).toMillis() : 0;
                        const bTime = b.createdAt && (b.createdAt as any).toMillis ? (b.createdAt as any).toMillis() : 0;
                        return aTime - bTime;
                      });

                      const quotationNumber = sortedAllQuotations.findIndex(q => q.id === selected.id) + 1;

                      return selected.createdAt && selected.shoppingListDate
                        ? `Cotação nº ${quotationNumber} de ${format((selected.shoppingListDate as any).toDate(), "dd/MM/yy")} (${format((selected.createdAt as any).toDate(), "HH:mm")}) - ${selected.status}`
                        : `Cotação de ${selected.shoppingListDate ? format((selected.shoppingListDate as any).toDate(), "dd/MM/yy") : "Data Inválida"} (Status: ${selected.status})`;
                    })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent className="card-professional">
                  {filteredQuotations.length === 0 && !isLoading &&
                    <SelectItem value="no-quote" disabled>
                      {selectedDate
                        ? `Nenhuma cotação para ${format(selectedDate, "dd/MM/yy")}`
                        : "Nenhuma cotação disponível"
                      }
                    </SelectItem>
                  }
                  {filteredQuotations.map((quotation) => {
                    // Handle virtual "nova-cotacao" entry
                    if (quotation.id === 'nova-cotacao') {
                      // Número sequencial global = total de cotações + 1
                      const nextNumber = allQuotations.length + 1;
                      const quotationName = `Nova cotação nº ${nextNumber} de ${format(quotation.shoppingListDate.toDate(), "dd/MM/yy")}`;

                      return (
                        <SelectItem key={quotation.id} value={quotation.id}>
                          {quotationName}
                        </SelectItem>
                      );
                    }

                    // Handle regular quotations - número sequencial global
                    const sortedAllQuotations = [...allQuotations].sort((a,b) => {
                      const aTime = a.createdAt && (a.createdAt as any).toMillis ? (a.createdAt as any).toMillis() : 0;
                      const bTime = b.createdAt && (b.createdAt as any).toMillis ? (b.createdAt as any).toMillis() : 0;
                      return aTime - bTime;
                    });

                    const quotationNumber = sortedAllQuotations.findIndex(q => q.id === quotation.id) + 1;

                    const quotationName = quotation.createdAt && quotation.shoppingListDate
                        ? `Cotação nº ${quotationNumber} de ${format((quotation.shoppingListDate as any).toDate(), "dd/MM/yy")} (${format((quotation.createdAt as any).toDate(), "HH:mm")}) - ${quotation.status}`
                        : `Cotação de ${quotation.shoppingListDate ? format((quotation.shoppingListDate as any).toDate(), "dd/MM/yy") : "Data Inválida"} (Status: ${quotation.status})`;

                    return (
                      <SelectItem key={quotation.id} value={quotation.id}>
                        {quotationName}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="icon"
                onClick={() => handleNavigate('next')}
                disabled={!canNavigateNext || isLoading}
                className="hover-lift"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

      {timeLeft && selectedQuotationId && (
        <Badge
          variant={isDeadlinePassed ? "destructive" : isQuotationPaused ? "outline" : "secondary"}
          className="text-base px-4 py-2 modern-shadow pulse-glow"
        >
          <Clock className="mr-2 h-5 w-5" /> {timeLeft}
        </Badge>
      )}
    </div>
  );

  // Se inline=true, retorna apenas o conteúdo
  if (inline) {
    return navigationContent;
  }

  // Senão, retorna com wrapper de section/header
  return (
    <section className={`card-professional modern-shadow-xl ${className}`} aria-labelledby="quotation-selector">
      <header className="p-6 border-b header-modern">
        <div className="flex flex-col items-center justify-center gap-6">
          {navigationContent}
        </div>
      </header>
    </section>
  );
}
