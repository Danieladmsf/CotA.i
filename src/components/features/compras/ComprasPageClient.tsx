"use client";

import * as React from "react";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams, useRouter } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShoppingCart, ListPlus, Users, Loader2, Send, Lock } from "lucide-react";
import { parseISO, isValid, format, startOfDay, endOfDay, isSameDay } from 'date-fns';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, Timestamp, orderBy } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import type { Quotation } from '@/types';
import QuotationNavigator from '@/components/shared/QuotationNavigator';

// Import components directly to avoid chunk loading issues
// These will be included in the main bundle but eliminate chunk loading errors
import GestaoComprasTab from "@/components/features/compras/GestaoComprasTab";
import NewShoppingListClient from "@/components/features/compras/NewShoppingListClient";
import SelecionarFornecedoresTab from "@/components/features/compras/SelecionarFornecedoresTab";
import ResultadoEnvioWrapper from "./ResultadoEnvioWrapper";


const TABS = [
  "criar-editar",
  "iniciar-cotacao",
  "resultado-envio",
  "gestao",
];

export default function ComprasPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState("criar-editar");
  const [listDateForQuotation, setListDateForQuotation] = useState<Date | null>(null);
  const [listIdForQuotation, setListIdForQuotation] = useState<string | null>(null);
  const [quotationStatus, setQuotationStatus] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [hasActiveQuotation, setHasActiveQuotation] = useState(false);
  const { user } = useAuth();

  // Track previous status to detect changes
  const previousStatusRef = React.useRef<string | null>(null);
  // Flag to prevent auto-select after auto-clear
  const isAutoClearingRef = React.useRef<boolean>(false);

  // New states for navigation system
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [navigableQuotations, setNavigableQuotations] = useState<Quotation[]>([]); // For arrow navigation
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  // State to track dates with quotations for badge display
  const [datesWithQuotations, setDatesWithQuotations] = useState<Set<string>>(new Set());

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

  // Fetch all quotations for the user
  useEffect(() => {
    if (!user) {
      setAllQuotations([]);
      setDatesWithQuotations(new Set());
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const q = query(
      collection(db, 'quotations'),
      where("userId", "==", user.uid),
      orderBy("shoppingListDate", "desc"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedQuotations = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));

      // Log quotations for debugging real-time sync
      console.log('[ComprasPageClient] Quotations updated from Firestore:', fetchedQuotations.map(q => ({
        id: q.id,
        status: q.status,
        listId: q.listId
      })));

      setAllQuotations(fetchedQuotations);

      // Calculate dates that have quotations for badge display
      const uniqueDates = new Set<string>();
      fetchedQuotations.forEach(quotation => {
        if (quotation.shoppingListDate) {
          const dateStr = format(quotation.shoppingListDate.toDate(), 'yyyy-MM-dd');
          uniqueDates.add(dateStr);
        }
      });
      setDatesWithQuotations(uniqueDates);

      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // Build navigable quotations list (allQuotations + virtual "nova cotacao" if needed)
  useEffect(() => {
    const today = new Date();

    // Check if there's an active quotation for today
    const todayQuotations = allQuotations.filter(q =>
      q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), today)
    );
    const hasActiveTodayQuotation = todayQuotations.some(q =>
      q.status === 'Aberta' || q.status === 'Pausada'
    );

    if (!hasActiveTodayQuotation) {
      // Add virtual "nova cotacao" for today at the BEGINNING (most recent)
      // This ensures chronological reverse order: newest first
      const virtualNewQuotation: Quotation = {
        id: 'nova-cotacao',
        status: 'Aberta',
        shoppingListDate: Timestamp.fromDate(today),
        createdAt: Timestamp.now(),
        listId: '',
        userId: user?.uid || '',
        supplierIds: [],
        deadline: Timestamp.now(),
        createdBy: user?.uid || ''
      };

      console.log('[ComprasPageClient] 📋 CRIANDO ARRAY DE COTAÇÕES NAVEGÁVEIS:');
      console.log('[ComprasPageClient] - Total de cotações do banco:', allQuotations.length);
      console.log('[ComprasPageClient] - Adicionando "Nova cotação" no INÍCIO (índice 0)');
      const finalArray = [virtualNewQuotation, ...allQuotations];
      console.log('[ComprasPageClient] - Array final ordenado:', finalArray.map((q, idx) => ({
        index: idx,
        id: q.id === 'nova-cotacao' ? '🆕 nova-cotacao' : q.id,
        date: q.shoppingListDate ? new Date(q.shoppingListDate.toDate()).toLocaleDateString('pt-BR') : 'N/A',
        status: q.status,
        createdAt: q.createdAt && 'toDate' in q.createdAt ? new Date(q.createdAt.toDate()).toLocaleString('pt-BR') : 'N/A'
      })));

      setNavigableQuotations(finalArray);
    } else {
      console.log('[ComprasPageClient] 📋 USANDO COTAÇÕES DO BANCO (já existe cotação ativa hoje):');
      console.log('[ComprasPageClient] - Total:', allQuotations.length);
      console.log('[ComprasPageClient] - Array ordenado:', allQuotations.map((q, idx) => ({
        index: idx,
        id: q.id,
        date: q.shoppingListDate ? new Date(q.shoppingListDate.toDate()).toLocaleDateString('pt-BR') : 'N/A',
        status: q.status,
        createdAt: q.createdAt && 'toDate' in q.createdAt ? new Date(q.createdAt.toDate()).toLocaleString('pt-BR') : 'N/A'
      })));
      setNavigableQuotations(allQuotations);
    }
  }, [allQuotations, user]);

  // Filter quotations by selected date
  useEffect(() => {
    const today = new Date();

    if (selectedDate) {
      const filtered = allQuotations.filter(q =>
        q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), selectedDate)
      );

      console.log('[ComprasPageClient] Filtering quotations for date:', {
        selectedDate: format(selectedDate, 'yyyy-MM-dd'),
        today: format(today, 'yyyy-MM-dd'),
        totalFiltered: filtered.length,
        activeCount: filtered.filter(q => q.status === 'Aberta' || q.status === 'Pausada').length,
        closedCount: filtered.filter(q => q.status === 'Fechada' || q.status === 'Concluída').length
      });

      // Add virtual "new quotation" option if all quotations are closed
      const allClosed = filtered.length > 0 && filtered.every(q => q.status === 'Fechada' || q.status === 'Concluída');
      if (allClosed || filtered.length === 0) {
        // Create a virtual quotation entry for "new quotation" - ALWAYS for TODAY
        // Add at BEGINNING to maintain chronological reverse order
        const virtualNewQuotation: Quotation = {
          id: 'nova-cotacao',
          status: 'Aberta',
          shoppingListDate: Timestamp.fromDate(today),
          createdAt: Timestamp.now(),
          listId: '',
          userId: user?.uid || '',
          supplierIds: [],
          deadline: Timestamp.now(),
          createdBy: user?.uid || ''
        };

        console.log('[ComprasPageClient] 🔍 FILTRO POR DATA - Adicionando "Nova cotação":');
        console.log('[ComprasPageClient] - Cotações filtradas:', filtered.length);
        console.log('[ComprasPageClient] - Todas fechadas?', allClosed);
        const finalFiltered = [virtualNewQuotation, ...filtered];
        console.log('[ComprasPageClient] - Array final filtrado:', finalFiltered.map((q, idx) => ({
          index: idx,
          id: q.id === 'nova-cotacao' ? '🆕 nova-cotacao' : q.id,
          date: q.shoppingListDate ? new Date(q.shoppingListDate.toDate()).toLocaleDateString('pt-BR') : 'N/A',
          status: q.status
        })));

        setFilteredQuotations(finalFiltered);
      } else {
        setFilteredQuotations(filtered);
      }
    } else {
      // Show only latest 10 active quotations if no date selected
      const activeQuotations = allQuotations.filter(q =>
        q.status === 'Aberta' || q.status === 'Pausada'
      );

      // Check if we should add "nova cotacao" for today
      const todayQuotations = allQuotations.filter(q =>
        q.shoppingListDate && isSameDay(q.shoppingListDate.toDate(), today)
      );
      const hasActiveTodayQuotation = todayQuotations.some(q => q.status === 'Aberta' || q.status === 'Pausada');

      if (!hasActiveTodayQuotation) {
        const virtualNewQuotation: Quotation = {
          id: 'nova-cotacao',
          status: 'Aberta',
          shoppingListDate: Timestamp.fromDate(today),
          createdAt: Timestamp.now(),
          listId: '',
          userId: user?.uid || '',
          supplierIds: [],
          deadline: Timestamp.now(),
          createdBy: user?.uid || ''
        };
        setFilteredQuotations([virtualNewQuotation, ...activeQuotations.slice(0, 10)]);
      } else {
        setFilteredQuotations(activeQuotations.slice(0, 10));
      }

      console.log('[ComprasPageClient] No date filter - showing active quotations:', activeQuotations.length);
    }
  }, [allQuotations, selectedDate, user]);

  // Track if user is manually selecting to prevent auto-select interference
  const isManuallySelectingRef = React.useRef<boolean>(false);

  // Auto-select first quotation when filtered list changes
  // Only auto-select if user is actively navigating quotations (has selected a date)
  useEffect(() => {
    // Don't auto-select if we're in "new quotation" mode (listDateForQuotation exists but no selectedQuotationId)
    const isNewQuotationMode = listDateForQuotation && !selectedQuotationId;

    console.log('[ComprasPageClient] Auto-select check:', {
      filteredQuotationsCount: filteredQuotations.length,
      selectedQuotationId,
      selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
      isNewQuotationMode,
      isAutoClearing: isAutoClearingRef.current,
      isManuallySelecting: isManuallySelectingRef.current,
      firstQuotation: filteredQuotations[0] ? {
        id: filteredQuotations[0].id,
        status: filteredQuotations[0].status
      } : null
    });

    // Don't auto-select if we're in the middle of an auto-clear operation
    if (isAutoClearingRef.current) {
      console.log('[ComprasPageClient] Skipping auto-select during auto-clear');
      return;
    }

    // Don't auto-select if user is manually selecting
    if (isManuallySelectingRef.current) {
      console.log('[ComprasPageClient] Skipping auto-select during manual selection');
      // Reset flag after a brief delay
      setTimeout(() => {
        isManuallySelectingRef.current = false;
      }, 100);
      return;
    }

    if (filteredQuotations.length > 0 && !selectedQuotationId && selectedDate && !isNewQuotationMode) {
      // Check if first quotation is closed - don't auto-select closed quotations
      const firstQuotation = filteredQuotations[0];
      if (firstQuotation.status === 'Fechada' || firstQuotation.status === 'Concluída') {
        console.log('[ComprasPageClient] Skipping auto-select - first quotation is closed:', firstQuotation.status);
        return;
      }

      // Only auto-select when date filter is active (user is browsing history)
      console.log('[ComprasPageClient] Auto-selecting first quotation');
      setSelectedQuotationId(filteredQuotations[0].id);
    } else if (filteredQuotations.length === 0 && !isNewQuotationMode) {
      console.log('[ComprasPageClient] No quotations available - clearing selection');
      setSelectedQuotationId(null);
    }
  }, [filteredQuotations, selectedQuotationId, selectedDate, listDateForQuotation]);

  // Navigation functions
  const handleDateChange = (date: Date | undefined) => {
    console.log('[ComprasPageClient] 📅 handleDateChange:', {
      date: date ? format(date, 'dd/MM/yyyy') : 'undefined',
      selectedQuotationId,
      isNavigating: isManuallySelectingRef.current
    });

    // Clear auto-clearing flag when user manually changes date
    isAutoClearingRef.current = false;
    setSelectedDate(date);

    // Se mudou para uma data diferente da cotação selecionada, limpar seleção
    // EXCETO se estamos navegando (isManuallySelectingRef = true)
    if (date && selectedQuotationId && !isManuallySelectingRef.current) {
      console.log('[ComprasPageClient] Verificando se deve limpar seleção...');
      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      if (selectedQuotation) {
        const quotationDate = selectedQuotation.shoppingListDate.toDate();
        const isSameDay = date.getDate() === quotationDate.getDate() &&
                          date.getMonth() === quotationDate.getMonth() &&
                          date.getFullYear() === quotationDate.getFullYear();

        // Se mudou para data diferente, limpar seleção de cotação
        if (!isSameDay) {
          console.log('[ComprasPageClient] ❌ Date changed - clearing quotation selection');
          previousStatusRef.current = null;
          setSelectedQuotationId(null);
          setListDateForQuotation(null);
          setListIdForQuotation(null);
          setQuotationStatus(null);
          setHasActiveQuotation(false);
        } else {
          console.log('[ComprasPageClient] ✅ Mesma data - mantendo seleção');
        }
      }
    } else if (isManuallySelectingRef.current) {
      console.log('[ComprasPageClient] ✅ Navegando - NÃO limpa seleção (isManuallySelectingRef = true)');
    }
  };

  const handleSelectQuotation = (id: string) => {
    console.log('[ComprasPageClient] handleSelectQuotation called with id:', id);

    // Set flag to prevent auto-select interference
    isManuallySelectingRef.current = true;

    // Handle special "nova-cotacao" action
    if (id === "nova-cotacao") {
      console.log('[ComprasPageClient] Selecting nova-cotacao - clearing state');
      setSelectedQuotationId("nova-cotacao");
      setListDateForQuotation(null);
      setListIdForQuotation(null);
      setQuotationStatus(null);
      setHasActiveQuotation(false);
      setActiveTab('criar-editar');
      return;
    }

    // Clear auto-clearing flag when user manually selects quotation
    isAutoClearingRef.current = false;
    // Reset previous status when manually selecting a different quotation
    previousStatusRef.current = null;

    console.log('[ComprasPageClient] Setting selectedQuotationId to:', id);
    setSelectedQuotationId(id);
  };

  // Update list date, ID, and status when quotation is selected or allQuotations changes
  // This ensures real-time sync when quotation status changes in Firestore
  useEffect(() => {
    console.log('[ComprasPageClient] Quotation effect triggered:', {
      selectedQuotationId,
      allQuotationsCount: allQuotations.length,
      previousStatus: previousStatusRef.current
    });

    if (selectedQuotationId) {
      // Handle virtual "nova-cotacao" selection
      if (selectedQuotationId === 'nova-cotacao') {
        console.log('[ComprasPageClient] ��� Virtual nova-cotacao selected - LIMPANDO DADOS:');
        console.log('[ComprasPageClient] - Definindo listIdForQuotation = null');
        console.log('[ComprasPageClient] - Definindo listDateForQuotation = null (força criação de nova lista HOJE)');
        console.log('[ComprasPageClient] - Definindo quotationStatus = null');
        console.log('[ComprasPageClient] - Definindo hasActiveQuotation = false');
        setListIdForQuotation(null);
        setListDateForQuotation(null); // NULL força criação de nova lista para HOJE
        setQuotationStatus(null);
        setHasActiveQuotation(false);
        previousStatusRef.current = null;
        return;
      }

      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      if (selectedQuotation) {
        console.log('[ComprasPageClient] Found selected quotation:', {
          id: selectedQuotation.id,
          status: selectedQuotation.status,
          listId: selectedQuotation.listId
        });

        setListIdForQuotation(selectedQuotation.listId);
        const shoppingListDate = selectedQuotation.shoppingListDate.toDate();
        setListDateForQuotation(shoppingListDate);

        // Always update status when quotation data changes
        setQuotationStatus(selectedQuotation.status);

        // Only mark as "active" if status is truly active (Aberta or Pausada)
        const isActive = selectedQuotation.status === 'Aberta' || selectedQuotation.status === 'Pausada';
        setHasActiveQuotation(isActive);

        if (!selectedDate) {
          console.log('[ComprasPageClient] Setting selectedDate to quotation date');
          setSelectedDate(shoppingListDate);
        }

        // Log for debugging real-time sync
        console.log('[ComprasPageClient] Quotation updated:', {
          id: selectedQuotation.id,
          status: selectedQuotation.status,
          isActive,
          listId: selectedQuotation.listId,
          shoppingListDate: format(shoppingListDate, 'yyyy-MM-dd HH:mm:ss')
        });

        // AUTO-CLEAR: If quotation just changed to Fechada or Concluída, clear selection
        const currentStatus = selectedQuotation.status;
        const previousStatus = previousStatusRef.current;

        // Only auto-clear if status CHANGED from active to closed (not if already closed)
        const wasActive = previousStatus === 'Aberta' || previousStatus === 'Pausada';
        const isNowClosed = currentStatus === 'Fechada' || currentStatus === 'Concluída';

        console.log('[ComprasPageClient] Auto-clear check:', {
          currentStatus,
          previousStatus,
          wasActive,
          isNowClosed,
          willAutoClear: wasActive && isNowClosed
        });

        if (wasActive && isNowClosed) {
          console.log('[ComprasPageClient] Quotation just closed - auto-clearing selection to allow new quotation', {
            previousStatus,
            currentStatus
          });

          // Set flag to prevent auto-select during clear
          isAutoClearingRef.current = true;

          // Small delay to let user see the final state before clearing
          setTimeout(() => {
            console.log('[ComprasPageClient] Executing auto-clear now...');
            previousStatusRef.current = null;
            setSelectedQuotationId(null);
            setSelectedDate(undefined);
            setListDateForQuotation(null);
            setListIdForQuotation(null);
            setQuotationStatus(null);
            setHasActiveQuotation(false);

            // Clear URL parameters
            const params = new URLSearchParams();
            params.set('tab', 'criar-editar');
            router.replace(`/compras?${params.toString()}`, { scroll: false });

            setActiveTab('criar-editar');

            // Reset flag after a brief delay to allow states to settle
            setTimeout(() => {
              isAutoClearingRef.current = false;
              console.log('[ComprasPageClient] Auto-clear complete - ready for new quotation');
            }, 500);
          }, 2000); // 2 second delay
        }

        // Update ref with current status
        previousStatusRef.current = currentStatus;
      } else {
        // Quotation was deleted or no longer accessible
        console.warn('[ComprasPageClient] Selected quotation not found in allQuotations');
        setQuotationStatus(null);
        setHasActiveQuotation(false);
        previousStatusRef.current = null;
      }
    } else {
      console.log('[ComprasPageClient] No quotation selected');
      setQuotationStatus(null);
      setHasActiveQuotation(false);
      previousStatusRef.current = null;
    }
  }, [selectedQuotationId, allQuotations, selectedDate, handleTabChange]);

  // Check if Passo 2 should be unlocked
  const shouldUnlockPasso2 = useMemo(() => {
    // Allow access if a new list is created
    if (listDateForQuotation && !selectedQuotationId) {
      return true;
    }
    // Allow access if ANY quotation is selected (active or historical)
    if (selectedQuotationId && selectedQuotationId !== 'nova-cotacao') {
      return true;
    }

    return false;
  }, [selectedQuotationId, listDateForQuotation]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'criar-editar';
    const dateStr = searchParams.get('date');
    const listIdStr = searchParams.get('listId');

    console.log('[ComprasPageClient] URL params changed:', {
      tab,
      dateStr,
      listIdStr,
      currentSelectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null,
      currentSelectedQuotationId: selectedQuotationId
    });

    setActiveTab(tab);

    // Only update list date/ID from URL params if they exist
    // Don't clear them when switching tabs if there's an active quotation
    // BUT: Never restore from URL when in "nova-cotacao" mode
    if (tab === 'iniciar-cotacao' && dateStr && listIdStr && selectedQuotationId !== 'nova-cotacao') {
        const parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            console.log('[ComprasPageClient] Setting list date/ID from URL:', { parsedDate, listIdStr });
            setListDateForQuotation(parsedDate);
            setListIdForQuotation(listIdStr);
        }
    } else if (selectedQuotationId === 'nova-cotacao') {
        console.log('[ComprasPageClient] Nova cotação ativa - mantendo listDate/ID limpos');
        // Keep them null for nova-cotacao
    } else if (!selectedQuotationId) {
        // Only clear if no quotation is selected (i.e., we're in "Sem Cotação" state)
        console.log('[ComprasPageClient] Clearing list date/ID - no quotation selected');
        setListDateForQuotation(null);
        setListIdForQuotation(null);
    }

    // Initialize date if not already set
    // But DON'T initialize if there's only closed quotations for today
    if (!selectedDate) {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');

      // Check if there are any quotations for today
      const quotationsForToday = allQuotations.filter(q =>
        q.shoppingListDate && format(q.shoppingListDate.toDate(), 'yyyy-MM-dd') === todayStr
      );

      // Check if all quotations for today are closed
      const allClosedForToday = quotationsForToday.length > 0 &&
        quotationsForToday.every(q => q.status === 'Fechada' || q.status === 'Concluída');

      if (allClosedForToday) {
        console.log('[ComprasPageClient] NOT initializing date - all quotations for today are closed');
        // Don't set date - leave it undefined so user starts with a clean slate
      } else {
        console.log('[ComprasPageClient] Initializing date to today');
        setSelectedDate(today);
      }
    }

  }, [searchParams, selectedDate, selectedQuotationId, allQuotations]);
  
  const handleListSaved = (listId: string, date: Date) => {
    // When a new list is saved, clear quotation selection to enable "new quotation" mode
    previousStatusRef.current = null;
    setSelectedQuotationId(null);
    setSelectedDate(undefined);
    setListDateForQuotation(date);
    setListIdForQuotation(listId);
    setQuotationStatus(null);
    setHasActiveQuotation(false);

    console.log('[ComprasPageClient] List saved, entering new quotation mode:', {
      listId,
      date: format(date, 'yyyy-MM-dd')
    });

    handleTabChange('iniciar-cotacao', date, listId);
  };

  const handleQuotationStarted = () => {
    // After quotation is started, wait for Firestore to sync and auto-select the new quotation
    setTimeout(() => {
      if (listIdForQuotation && !selectedQuotationId) {
        // Find the quotation that was just created for this list
        const newQuotation = allQuotations.find(q => q.listId === listIdForQuotation);
        if (newQuotation) {
          console.log('[ComprasPageClient] Auto-selecting newly created quotation:', newQuotation.id);
          previousStatusRef.current = null; // Reset to track this new quotation's status
          setSelectedQuotationId(newQuotation.id);
          setSelectedDate(newQuotation.shoppingListDate.toDate());
        }
      }
    }, 1000); // Wait 1 second for Firestore to sync

    handleTabChange('gestao');
  };

  const handleDateChangeForList = (newDate: Date) => {
      setSelectedDate(newDate);
      if(activeTab === 'iniciar-cotacao') {
          handleTabChange('iniciar-cotacao', newDate, listIdForQuotation ?? undefined);
      }
  }

  if (isLoading) {
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
      {/* Navigation Header - Componente Centralizado */}
      <QuotationNavigator
        allQuotations={allQuotations}
        filteredQuotations={filteredQuotations}
        navigableQuotations={navigableQuotations}
        selectedDate={selectedDate}
        selectedQuotationId={selectedQuotationId}
        isLoading={isLoading}
        onDateChange={handleDateChange}
        onQuotationSelect={handleSelectQuotation}
        showBadgeInfo={true}
        enableNavigationLoop={false}
        updateDateOnNavigate={true}
      />

      <section className="w-full" aria-labelledby="compras-tabs">
        <Tabs
          key={`${hasActiveQuotation}-${quotationStatus}-${selectedQuotationId}`}
          value={activeTab}
          onValueChange={(tab) => handleTabChange(tab, listDateForQuotation ?? selectedDate ?? new Date(), listIdForQuotation ?? undefined)}
          className="w-full"
        >
          <TabsList className={`grid w-full grid-cols-1 sm:grid-cols-4 h-auto modern-shadow-lg card-professional p-2 ${
            hasActiveQuotation ? 'bg-purple-100' :
            selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'bg-amber-50' :
            ''
          }`} role="tablist" aria-label="Etapas do processo de compras">
            <TabsTrigger
              value="criar-editar"
              className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                hasActiveQuotation ? 'text-purple-800' :
                selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                ''
              }`}
              role="tab"
              aria-selected={activeTab === "criar-editar"}
            >
              <ListPlus className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span>Passo 1: Criar Lista</span>
              {hasActiveQuotation && (
                <Badge variant="secondary" className="ml-2 text-xs bg-purple-200 text-purple-800 border-purple-300">
                  EM ANDAMENTO
                </Badge>
              )}
            </TabsTrigger>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="iniciar-cotacao"
                    className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                      hasActiveQuotation ? 'text-purple-800' :
                      selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                      ''
                    } ${!shouldUnlockPasso2 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!shouldUnlockPasso2}
                    role="tab"
                    aria-selected={activeTab === "iniciar-cotacao"}
                  >
                    {!shouldUnlockPasso2 ? (
                      <Lock className="h-6 w-6 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Users className="h-6 w-6 rotate-hover" aria-hidden="true" />
                    )}
                    <span className={!shouldUnlockPasso2 ? 'text-gray-400' : ''}>
                      Passo 2: Iniciar Cotação
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                {!shouldUnlockPasso2 && (
                  <TooltipContent>
                    <p className="text-sm">Para acessar esta etapa:</p>
                    <p className="text-xs text-muted-foreground">
                      • Crie uma nova lista no &quot;Passo 1&quot;, ou<br />
                      • Selecione uma cotação histórica no navegador acima
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <TabsTrigger
              value="resultado-envio"
              className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                hasActiveQuotation ? 'text-purple-800' :
                selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                ''
              }`}
              role="tab"
              aria-selected={activeTab === "resultado-envio"}
            >
              <Send className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span className={`${!hasActiveQuotation && !selectedQuotationId ? 'text-blue-600' : ''}`}>
                Passo 3: Resultado & Envio
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="gestao"
              className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                hasActiveQuotation ? 'text-purple-800' :
                selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                ''
              }`}
              role="tab"
              aria-selected={activeTab === "gestao"}
            >
              <ShoppingCart className="h-6 w-6 rotate-hover" aria-hidden="true" />
              <span className={`${!hasActiveQuotation && !selectedQuotationId ? 'text-green-600' : ''}`}>
                Gestão de Cotações
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="criar-editar" className="mt-8 fade-in" role="tabpanel" aria-labelledby="criar-editar-tab">
            {(() => {
              // Use listDateForQuotation if from an active quotation
              let dateToPass = listDateForQuotation || selectedDate;

              // Check if we should avoid today's date due to closed quotations
              // OR if we're in "nova-cotacao" mode
              const isNovaCotacao = selectedQuotationId === 'nova-cotacao';
              if (dateToPass && !listDateForQuotation && (!selectedQuotationId || isNovaCotacao)) {
                const today = new Date();
                const todayStr = format(today, 'yyyy-MM-dd');
                const dateToPassStr = format(dateToPass, 'yyyy-MM-dd');

                console.log('[ComprasPageClient] 📅 Verificando ajuste de data:', {
                  isNovaCotacao,
                  dateToPass: dateToPassStr,
                  today: todayStr,
                  isSameDay: dateToPassStr === todayStr
                });

                // If dateToPass is today, check if today has only closed quotations
                if (dateToPassStr === todayStr) {
                  const quotationsForToday = allQuotations.filter(q =>
                    q.shoppingListDate && format(q.shoppingListDate.toDate(), 'yyyy-MM-dd') === todayStr
                  );
                  const hasClosedQuotationsToday = quotationsForToday.length > 0 &&
                    quotationsForToday.every(q => q.status === 'Fechada' || q.status === 'Concluída');

                  console.log('[ComprasPageClient] Verificação de cotações fechadas:', {
                    quotationsForTodayCount: quotationsForToday.length,
                    hasClosedQuotationsToday
                  });

                  if (hasClosedQuotationsToday) {
                    // Use tomorrow to start fresh - avoiding today's closed quotations
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    dateToPass = tomorrow;
                    console.log('[ComprasPageClient] ✅ Substituindo data de hoje por amanhã:', format(tomorrow, 'yyyy-MM-dd'));
                  }
                }
              }

              // Fallback if still no date
              if (!dateToPass) {
                dateToPass = new Date();
                console.log('[ComprasPageClient] Using today as final fallback');
              }

              const listIdToPass = selectedQuotationId === 'nova-cotacao' ? null : listIdForQuotation;

              console.log('[ComprasPageClient] Rendering NewShoppingListClient with:', {
                listDateForQuotation: listDateForQuotation ? format(listDateForQuotation, 'yyyy-MM-dd HH:mm:ss') : null,
                selectedDate: selectedDate ? format(selectedDate, 'yyyy-MM-dd HH:mm:ss') : null,
                dateToPass: dateToPass ? format(dateToPass, 'yyyy-MM-dd HH:mm:ss') : 'UNDEFINED',
                hasActiveQuotation,
                quotationStatus,
                selectedQuotationId,
                listIdForQuotation,
                listIdToPass: listIdToPass,
                isNovaCotacao: selectedQuotationId === 'nova-cotacao',
                allQuotationsCount: allQuotations.length
              });
              return (
                <NewShoppingListClient
                  selectedDate={dateToPass!}
                  onDateChange={handleDateChangeForList}
                  onListSaved={handleListSaved}
                  hasActiveQuotation={hasActiveQuotation}
                  quotationStatus={quotationStatus}
                  listId={listIdToPass}
                />
              );
            })()}
          </TabsContent>

          <TabsContent value="iniciar-cotacao" className="mt-8 fade-in" role="tabpanel" aria-labelledby="iniciar-cotacao-tab">
            <SelecionarFornecedoresTab
              shoppingListDate={listDateForQuotation}
              listId={listIdForQuotation}
              onQuotationStarted={handleQuotationStarted}
              selectedQuotationId={selectedQuotationId}
              quotationStatus={quotationStatus}
              hasActiveQuotation={hasActiveQuotation}
              onTabChange={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="resultado-envio" className="mt-8 fade-in" role="tabpanel" aria-labelledby="resultado-envio-tab">
            <ResultadoEnvioWrapper
              selectedQuotationId={selectedQuotationId}
              onTabChange={setActiveTab}
            />
          </TabsContent>

          <TabsContent value="gestao" className="mt-8 fade-in" role="tabpanel" aria-labelledby="gestao-tab">
            <GestaoComprasTab selectedQuotationId={selectedQuotationId} />
          </TabsContent>

        </Tabs>
      </section>
    </main>
  );
}