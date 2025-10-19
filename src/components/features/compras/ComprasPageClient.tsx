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
import { useToast } from '@/hooks/use-toast';
import { closeQuotationAndItems } from '@/actions/quotationActions';

// Import components directly to avoid chunk loading issues
// These will be included in the main bundle but eliminate chunk loading errors
import GestaoComprasTab from "@/components/features/compras/GestaoComprasTab";
import NewShoppingListClient from "@/components/features/compras/NewShoppingListClient";
import SelecionarFornecedoresTab from "@/components/features/compras/SelecionarFornecedoresTab";
import ResultadoEnvioWrapper from "./ResultadoEnvioWrapper";

// Enum para as 3 situações/formatações da página
type PageMode = 'NEW_QUOTATION' | 'ACTIVE_QUOTATION' | 'CLOSED_QUOTATION';

const TABS = [
  "criar-editar",
  "iniciar-cotacao",
  "resultado-envio",
  "gestao",
];

// Helper function to create virtual "nova-cotacao" entry
const createVirtualNewQuotation = (date: Date, userId: string): Quotation => ({
  id: 'nova-cotacao',
  status: 'Aberta',
  shoppingListDate: Timestamp.fromDate(date),
  createdAt: Timestamp.now(),
  listId: '',
  userId,
  supplierIds: [],
  deadline: Timestamp.now(),
  createdBy: userId
});

export default function ComprasPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState("criar-editar");
  const [listDateForQuotation, setListDateForQuotation] = useState<Date | null>(null);
  const [listIdForQuotation, setListIdForQuotation] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  // New states for navigation system
  const [allQuotations, setAllQuotations] = useState<Quotation[]>([]);
  const [filteredQuotations, setFilteredQuotations] = useState<Quotation[]>([]);
  const [navigableQuotations, setNavigableQuotations] = useState<Quotation[]>([]); // For arrow navigation
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedQuotationId, setSelectedQuotationId] = useState<string | null>(null);

  // State to track dates with quotations for badge display
  const [datesWithQuotations, setDatesWithQuotations] = useState<Set<string>>(new Set());

  // Derived values - computed from selectedQuotationId and allQuotations
  const quotationStatus = useMemo(() => {
    if (!selectedQuotationId) return null;
    const quotation = allQuotations.find(q => q.id === selectedQuotationId);
    return quotation?.status || null;
  }, [selectedQuotationId, allQuotations]);

  const hasActiveQuotation = useMemo(() => {
    return quotationStatus === 'Aberta' || quotationStatus === 'Pausada';
  }, [quotationStatus]);

  // Determinar o modo da página (3 situações)
  const pageMode = useMemo((): PageMode => {
    if (hasActiveQuotation) {
      return 'ACTIVE_QUOTATION'; // 1️⃣ Roxa - Cotação em andamento
    }
    if (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') {
      return 'CLOSED_QUOTATION'; // 2️⃣ Âmbar - Cotação encerrada
    }
    return 'NEW_QUOTATION'; // 3️⃣ Azul - Nova cotação
  }, [hasActiveQuotation, quotationStatus]);


  // Track previous status to detect changes
  const previousStatusRef = React.useRef<string | null>(null);
  // Flag to prevent auto-select after auto-clear
  const isAutoClearingRef = React.useRef<boolean>(false);
  // Flag to prevent auto-select after saving list
  const justSavedListRef = React.useRef<boolean>(false);
  // Flag to prevent auto-select after starting quotation
  const justStartedQuotationRef = React.useRef<boolean>(false);
  // Ref to track quotations being closed to prevent duplicate calls
  const closingQuotationsRef = React.useRef<Set<string>>(new Set());

  const handleTabChange = useCallback((value: string, date?: Date, listId?: string) => {
    const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
    const isClosed = selectedQuotation?.status === 'Fechada' || selectedQuotation?.status === 'Concluída';


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

    const newUrl = `/compras?${params.toString()}`;
    router.replace(newUrl, { scroll: false });
  }, [router, pageMode, selectedQuotationId, hasActiveQuotation, allQuotations, activeTab]);

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

  // Auto-close expired quotations
  const handleAutoCloseQuotation = useCallback(async (quotationId: string) => {
    if (!user) return;

    if (closingQuotationsRef.current.has(quotationId)) {
      return;
    }

    closingQuotationsRef.current.add(quotationId);

    const result = await closeQuotationAndItems(quotationId, user.uid);

    if (result.success && (result.updatedItemsCount ?? 0) > 0) {
      toast({
        title: "Cotação Encerrada Automaticamente",
        description: `O prazo expirou. ${result.updatedItemsCount} item(ns) foram marcados como 'Encerrado'.`,
      });
    } else if (!result.success) {
      console.error('❌ [ComprasPageClient] Failed to close quotation:', result.error);
      toast({
        title: "Erro ao fechar cotação",
        description: result.error || "Não foi possível atualizar o status da cotação.",
        variant: "destructive",
      });
    }

    closingQuotationsRef.current.delete(quotationId);
  }, [user, toast]);

  // Monitor quotations for expired deadlines
  useEffect(() => {
    if (!allQuotations.length) return;

    const now = new Date();

    allQuotations.forEach(quotation => {
      // Skip if already closed or no deadline
      if (!quotation.deadline || quotation.status === 'Fechada' || quotation.status === 'Concluída') {
        return;
      }

      const deadlineDate = quotation.deadline.toDate();
      const isExpired = deadlineDate.getTime() <= now.getTime();

      if (isExpired) {
        handleAutoCloseQuotation(quotation.id);
      }
    });

    // Set up interval to check every 30 seconds
    const intervalId = setInterval(() => {
      const now = new Date();

      allQuotations.forEach(quotation => {
        if (!quotation.deadline || quotation.status === 'Fechada' || quotation.status === 'Concluída') {
          return;
        }

        const deadlineDate = quotation.deadline.toDate();
        const isExpired = deadlineDate.getTime() <= now.getTime();

        if (isExpired) {
          handleAutoCloseQuotation(quotation.id);
        }
      });
    }, 30000); // Check every 30 seconds

    return () => clearInterval(intervalId);
  }, [allQuotations, handleAutoCloseQuotation]);

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
      const virtualNewQuotation = createVirtualNewQuotation(today, user?.uid || '');
      const finalArray = [virtualNewQuotation, ...allQuotations];

      setNavigableQuotations(finalArray);
    } else {
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


      // Add virtual "new quotation" option if all quotations are closed
      const allClosed = filtered.length > 0 && filtered.every(q => q.status === 'Fechada' || q.status === 'Concluída');
      if (allClosed || filtered.length === 0) {
        // Create a virtual quotation entry for "new quotation" - ALWAYS for TODAY
        // Add at BEGINNING to maintain chronological reverse order
        const virtualNewQuotation = createVirtualNewQuotation(today, user?.uid || '');
        const finalFiltered = [virtualNewQuotation, ...filtered];

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
        const virtualNewQuotation = createVirtualNewQuotation(today, user?.uid || '');
        const finalFiltered = [virtualNewQuotation, ...activeQuotations.slice(0, 10)];
        setFilteredQuotations(finalFiltered);
      } else {
        setFilteredQuotations(activeQuotations.slice(0, 10));
      }

    }
  }, [allQuotations, selectedDate, user]);

  // Track if user is manually selecting to prevent auto-select interference
  const isManuallySelectingRef = React.useRef<boolean>(false);

  // Auto-select first quotation when filtered list changes
  // Only auto-select if user is actively navigating quotations (has selected a date)
  useEffect(() => {
    // Don't auto-select if we're in "new quotation" mode (listDateForQuotation exists but no selectedQuotationId)
    const isNewQuotationMode = listDateForQuotation && !selectedQuotationId;

    // Don't auto-select if we're in the middle of an auto-clear operation
    if (isAutoClearingRef.current) {
      return;
    }

    // Don't auto-select if user is manually selecting
    if (isManuallySelectingRef.current) {
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
        return;
      }

      // Only auto-select when date filter is active (user is browsing history)
      setSelectedQuotationId(filteredQuotations[0].id);
    } else if (filteredQuotations.length === 0 && !isNewQuotationMode) {
      setSelectedQuotationId(null);
    }
  }, [filteredQuotations, selectedQuotationId, selectedDate, listDateForQuotation]);

  // Navigation functions
  const handleDateChange = (date: Date | undefined) => {

    // Clear auto-clearing flag when user manually changes date
    isAutoClearingRef.current = false;
    setSelectedDate(date);

    // Se mudou para uma data diferente da cotação selecionada, limpar seleção
    // EXCETO se estamos navegando (isManuallySelectingRef = true)
    if (date && selectedQuotationId && !isManuallySelectingRef.current) {
      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      if (selectedQuotation) {
        const quotationDate = selectedQuotation.shoppingListDate.toDate();
        const isSameDay = date.getDate() === quotationDate.getDate() &&
                          date.getMonth() === quotationDate.getMonth() &&
                          date.getFullYear() === quotationDate.getFullYear();

        // Se mudou para data diferente, limpar seleção de cotação
        if (!isSameDay) {
          previousStatusRef.current = null;
          setSelectedQuotationId(null);
          setListDateForQuotation(null);
          setListIdForQuotation(null);
        } else {
        }
      }
    } else if (isManuallySelectingRef.current) {
    }
  };

  const handleSelectQuotation = (id: string) => {

    // Set flag to prevent auto-select interference
    isManuallySelectingRef.current = true;

    // Handle special "nova-cotacao" action
    if (id === "nova-cotacao") {
      setSelectedQuotationId("nova-cotacao");
      setListDateForQuotation(null);
      setListIdForQuotation(null);
      setActiveTab('criar-editar');
      return;
    }

    // Log when user selects a quotation
    const quotation = allQuotations.find(q => q.id === id);
    const isClosed = quotation?.status === 'Fechada' || quotation?.status === 'Concluída';

    // Clear auto-clearing flag when user manually selects quotation
    isAutoClearingRef.current = false;
    // Reset previous status when manually selecting a different quotation
    previousStatusRef.current = null;

    setSelectedQuotationId(id);
  };

  // Update list date, ID, and status when quotation is selected or allQuotations changes
  // This ensures real-time sync when quotation status changes in Firestore
  useEffect(() => {

    if (selectedQuotationId) {
      // Handle virtual "nova-cotacao" selection
      if (selectedQuotationId === 'nova-cotacao') {
        setListIdForQuotation(null);
        setListDateForQuotation(null); // NULL força criação de nova lista para HOJE
        previousStatusRef.current = null;
        return;
      }

      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      if (selectedQuotation) {

        setListIdForQuotation(selectedQuotation.listId);
        const shoppingListDate = selectedQuotation.shoppingListDate.toDate();
        setListDateForQuotation(shoppingListDate);

        if (!selectedDate) {
          setSelectedDate(shoppingListDate);
        }

        // AUTO-CLEAR: If quotation just changed to Fechada or Concluída, clear selection
        const currentStatus = selectedQuotation.status;
        const previousStatus = previousStatusRef.current;


        // Only auto-clear if status CHANGED from active to closed (not if already closed)
        const wasActive = previousStatus === 'Aberta' || previousStatus === 'Pausada';
        const isNowClosed = currentStatus === 'Fechada' || currentStatus === 'Concluída';

        if (wasActive && isNowClosed) {

          // Set flag to prevent auto-select during clear
          isAutoClearingRef.current = true;

          // Small delay to let user see the final state before clearing
          setTimeout(() => {
            previousStatusRef.current = null;
            setSelectedQuotationId(null);
            setSelectedDate(undefined);
            setListDateForQuotation(null);
            setListIdForQuotation(null);

            // Clear URL parameters
            const params = new URLSearchParams();
            params.set('tab', 'criar-editar');
            router.replace(`/compras?${params.toString()}`, { scroll: false });

            setActiveTab('criar-editar');

            // Reset flag after a brief delay to allow states to settle
            setTimeout(() => {
              isAutoClearingRef.current = false;

              // Auto-select "nova-cotacao" to show in navigator
              setTimeout(() => {
                setSelectedQuotationId('nova-cotacao');
                // Set date to today for nova-cotacao
                const today = new Date();
                setSelectedDate(today);
              }, 300);
            }, 500);
          }, 2000); // 2 second delay
        }

        // Update ref with current status
        previousStatusRef.current = currentStatus;
      } else {
        // Quotation was deleted or no longer accessible
        console.warn('⚠️ [ComprasPageClient] Selected quotation not found in allQuotations');
        previousStatusRef.current = null;
      }
    } else {
      previousStatusRef.current = null;
    }
  }, [selectedQuotationId, allQuotations, selectedDate, handleTabChange, router]);

  // Check if Passo 2 should be unlocked
  const shouldUnlockPasso2 = useMemo(() => {
    // Allow access if a new list is created
    if (listDateForQuotation && !selectedQuotationId) {
      return true;
    }
    // Allow access if ANY quotation is selected (active or historical)
    if (selectedQuotationId && selectedQuotationId !== 'nova-cotacao') {
      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      const isClosed = selectedQuotation?.status === 'Fechada' || selectedQuotation?.status === 'Concluída';
      return true;
    }

    return false;
  }, [selectedQuotationId, listDateForQuotation, allQuotations]);

  const shouldUnlockPasso3 = useMemo(() => {
    // Only unlock if there's a REAL quotation selected (not nova-cotacao, not null)
    const shouldUnlock = selectedQuotationId !== null && selectedQuotationId !== 'nova-cotacao';

    if (shouldUnlock) {
      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      const isClosed = selectedQuotation?.status === 'Fechada' || selectedQuotation?.status === 'Concluída';
    } else {
    }

    return shouldUnlock;
  }, [selectedQuotationId, allQuotations]);

  const shouldUnlockGestao = useMemo(() => {
    // Only unlock if there's a REAL quotation selected (not nova-cotacao, not null)
    const shouldUnlock = selectedQuotationId !== null && selectedQuotationId !== 'nova-cotacao';

    if (shouldUnlock) {
      const selectedQuotation = allQuotations.find(q => q.id === selectedQuotationId);
      const isClosed = selectedQuotation?.status === 'Fechada' || selectedQuotation?.status === 'Concluída';
    } else {
    }

    return shouldUnlock;
  }, [selectedQuotationId, allQuotations]);

  useEffect(() => {
    const tab = searchParams.get('tab') || 'criar-editar';
    const dateStr = searchParams.get('date');
    const listIdStr = searchParams.get('listId');


    if (activeTab !== tab) {
    }

    setActiveTab(tab);

    // Only update list date/ID from URL params if they exist
    // Don't clear them when switching tabs if there's an active quotation
    // BUT: Never restore from URL when in "nova-cotacao" mode
    if (tab === 'iniciar-cotacao' && dateStr && listIdStr && selectedQuotationId !== 'nova-cotacao') {
        const parsedDate = parseISO(dateStr);
        if (isValid(parsedDate)) {
            setListDateForQuotation(parsedDate);
            setListIdForQuotation(listIdStr);
        }
    } else if (selectedQuotationId === 'nova-cotacao') {
        // Keep them null for nova-cotacao
    } else if (!selectedQuotationId && !justSavedListRef.current && !justStartedQuotationRef.current) {
        // Only clear if no quotation is selected (i.e., we're in "Sem Cotação" state)
        // AND we didn't just save a list (to preserve the data for navigation)
        // AND we didn't just start a quotation (to preserve the data while waiting for Firestore)
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
        // Don't set date - leave it undefined so user starts with a clean slate
      } else {
        setSelectedDate(today);
      }
    }

  }, [searchParams, selectedDate, selectedQuotationId, allQuotations]);

  // Redirecionamento automático para etapa 1 APENAS quando selecionar "nova-cotacao" ou sem cotação
  useEffect(() => {
    // Só redireciona se:
    // 1. Está em NEW_QUOTATION (nova cotação ou sem cotação)
    // 2. Não está na aba criar-editar
    // 3. Não tem cotação real selecionada (ou é nova-cotacao)
    // 4. NÃO acabou de salvar uma nova lista (listDateForQuotation indica que lista foi salva e usuário deve ir para etapa 2)
    const shouldRedirect =
      pageMode === 'NEW_QUOTATION' &&
      activeTab !== 'criar-editar' &&
      (!selectedQuotationId || selectedQuotationId === 'nova-cotacao') &&
      !listDateForQuotation; // CRITICAL: Don't redirect if we just saved a new list

    if (shouldRedirect) {
      handleTabChange('criar-editar', selectedDate ?? new Date(), listIdForQuotation ?? undefined);
    } else if (pageMode === 'NEW_QUOTATION' && activeTab !== 'criar-editar' && listDateForQuotation) {
      // Nova lista foi salva - permitir navegação para etapa 2
    } else if (pageMode === 'CLOSED_QUOTATION' && activeTab !== 'criar-editar') {
      // Cotação fechada pode navegar livremente - apenas log
    } else if (pageMode === 'CLOSED_QUOTATION') {
    }
  }, [pageMode, activeTab, handleTabChange, selectedDate, listIdForQuotation, selectedQuotationId, quotationStatus]);

  // Auto-selecionar cotação quando não houver seleção
  useEffect(() => {

    // SPECIAL CASE: If we just started a quotation and we're on gestao tab, try to auto-select the new quotation
    if (justStartedQuotationRef.current && activeTab === 'gestao' && !selectedQuotationId && listIdForQuotation) {
      const newQuotation = allQuotations.find(q => q.listId === listIdForQuotation);
      if (newQuotation) {
        previousStatusRef.current = null; // Reset to track this new quotation's status
        setSelectedQuotationId(newQuotation.id);
        setSelectedDate(newQuotation.shoppingListDate.toDate());
        return;
      } else {
      }
    }

    // Não auto-selecionar se acabamos de salvar a lista, estamos auto-clearing, ou acabamos de iniciar cotação
    if (justSavedListRef.current || isAutoClearingRef.current || justStartedQuotationRef.current) {
      return;
    }

    // CASO 1: Se não há cotação selecionada
    if (!selectedQuotationId) {
      // Não auto-selecionar cotação ativa se estamos na etapa "iniciar-cotacao"
      // porque significa que o usuário acabou de criar a lista e vai iniciar a cotação
      if (activeTab === 'iniciar-cotacao') {
        return;
      }

      // Prioridade 1: Se há cotação ativa, selecionar a primeira
      const firstActive = filteredQuotations.find(q => q.status === 'Aberta' || q.status === 'Pausada');

      if (firstActive) {
        setSelectedQuotationId(firstActive.id);
        return;
      }

      // Prioridade 2: Se há "nova-cotacao" disponível, selecionar
      const hasNovaCotacao = navigableQuotations.some(q => q.id === 'nova-cotacao');
      if (hasNovaCotacao && !selectedDate) {
        setSelectedQuotationId('nova-cotacao');
        return;
      }

    }

    // CASO 2: Se "nova-cotacao" está selecionada mas não existe mais em navigableQuotations
    // (significa que uma cotação ativa foi criada)
    if (selectedQuotationId === 'nova-cotacao') {
      const novaCotacaoStillExists = navigableQuotations.some(q => q.id === 'nova-cotacao');

      if (!novaCotacaoStillExists) {
        // Trocar para a cotação ativa mais recente
        const firstActive = filteredQuotations.find(q => q.status === 'Aberta' || q.status === 'Pausada');

        if (firstActive) {
          setSelectedQuotationId(firstActive.id);
          return;
        }
      }
    }
  }, [selectedQuotationId, selectedDate, navigableQuotations, filteredQuotations, activeTab, listIdForQuotation, allQuotations]);

  const handleListSaved = (listId: string, date: Date) => {

    // Set flag to prevent auto-select from interfering
    justSavedListRef.current = true;

    // When a new list is saved, clear quotation selection to enable "new quotation" mode
    previousStatusRef.current = null;
    setSelectedQuotationId(null);
    setSelectedDate(undefined);
    setListDateForQuotation(date);
    setListIdForQuotation(listId);

    handleTabChange('iniciar-cotacao', date, listId);

    // Reset flag after auto-select and Firestore sync are complete
    // Increased to 1500ms to avoid race with quotation creation
    setTimeout(() => {
      justSavedListRef.current = false;
    }, 1500);
  };

  const handleQuotationStarted = () => {

    // Set flag to prevent auto-select during transition to gestao tab
    justStartedQuotationRef.current = true;

    handleTabChange('gestao');

    // The Firestore snapshot listener will automatically detect the new quotation
    // and the auto-select logic will pick it up once justStartedQuotationRef is cleared
    // No need to manually search - just wait for Firestore to sync

    // Reset flag after giving Firestore time to sync
    // Increased to 3000ms to ensure quotation is created and Firestore snapshot received
    setTimeout(() => {
      justStartedQuotationRef.current = false;
    }, 3000);
  };

  const handleDateChangeForList = (newDate: Date) => {
      setSelectedDate(newDate);
      if(activeTab === 'iniciar-cotacao') {
          handleTabChange('iniciar-cotacao', newDate, listIdForQuotation ?? undefined);
      }
  }

  // Helper functions for CSS classes
  const getTabsListBackgroundClass = () => {
    if (hasActiveQuotation) return 'bg-purple-100';
    if (selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída'))
      return 'bg-amber-50';
    return '';
  };

  const getTabTriggerTextClass = () => {
    if (hasActiveQuotation) return 'text-purple-800';
    if (selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída'))
      return 'text-amber-600';
    return '';
  };

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

  // Log final antes de renderizar

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
          <TabsList className={`grid w-full grid-cols-1 sm:grid-cols-4 h-auto modern-shadow-lg card-professional p-2 ${getTabsListBackgroundClass()}`} role="tablist" aria-label="Etapas do processo de compras">
            <TabsTrigger
              value="criar-editar"
              className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${getTabTriggerTextClass()}`}
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
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="resultado-envio"
                    className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                      hasActiveQuotation ? 'text-purple-800' :
                      selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                      ''
                    } ${!shouldUnlockPasso3 ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!shouldUnlockPasso3}
                    role="tab"
                    aria-selected={activeTab === "resultado-envio"}
                  >
                    {!shouldUnlockPasso3 ? (
                      <Lock className="h-6 w-6 text-gray-400" aria-hidden="true" />
                    ) : (
                      <Send className="h-6 w-6 rotate-hover" aria-hidden="true" />
                    )}
                    <span className={!shouldUnlockPasso3 ? 'text-gray-400' : ''}>
                      Passo 3: Resultado & Envio
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                {!shouldUnlockPasso3 && (
                  <TooltipContent>
                    <p className="text-sm">Para acessar esta etapa:</p>
                    <p className="text-xs text-muted-foreground">
                      • Inicie uma cotação no &quot;Passo 2&quot;, ou<br />
                      • Selecione uma cotação existente no navegador acima
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <TabsTrigger
                    value="gestao"
                    className={`py-4 px-6 flex items-center justify-center gap-3 nav-item-modern font-heading font-semibold text-base data-[state=active]:bg-blue-100 data-[state=active]:text-blue-900 ${
                      hasActiveQuotation ? 'text-purple-800' :
                      selectedQuotationId && (quotationStatus === 'Fechada' || quotationStatus === 'Concluída') ? 'text-amber-600' :
                      ''
                    } ${!shouldUnlockGestao ? 'opacity-50 cursor-not-allowed' : ''}`}
                    disabled={!shouldUnlockGestao}
                    role="tab"
                    aria-selected={activeTab === "gestao"}
                  >
                    {!shouldUnlockGestao ? (
                      <Lock className="h-6 w-6 text-gray-400" aria-hidden="true" />
                    ) : (
                      <ShoppingCart className="h-6 w-6 rotate-hover" aria-hidden="true" />
                    )}
                    <span className={!shouldUnlockGestao ? 'text-gray-400' : ''}>
                      Gestão de Cotações
                    </span>
                  </TabsTrigger>
                </TooltipTrigger>
                {!shouldUnlockGestao && (
                  <TooltipContent>
                    <p className="text-sm">Para acessar esta etapa:</p>
                    <p className="text-xs text-muted-foreground">
                      • Inicie uma cotação no &quot;Passo 2&quot;, ou<br />
                      • Selecione uma cotação existente no navegador acima
                    </p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          </TabsList>

          <TabsContent value="criar-editar" className="mt-8 fade-in" role="tabpanel" aria-labelledby="criar-editar-tab">
            {(() => {
              // Determinar se estamos em modo "sem cotação"
              const isNovaCotacao = selectedQuotationId === 'nova-cotacao';
              const hasNoQuotationSelected = !selectedQuotationId || isNovaCotacao;

              // Use listDateForQuotation if from an active quotation
              let dateToPass = listDateForQuotation || selectedDate;

              // Check if we should avoid today's date due to closed quotations
              // OR if we're in "nova-cotacao" mode
              if (dateToPass && !listDateForQuotation && hasNoQuotationSelected) {
                const today = new Date();
                const todayStr = format(today, 'yyyy-MM-dd');
                const dateToPassStr = format(dateToPass, 'yyyy-MM-dd');

                // If dateToPass is today, check if today has only closed quotations
                if (dateToPassStr === todayStr) {
                  const quotationsForToday = allQuotations.filter(q =>
                    q.shoppingListDate && format(q.shoppingListDate.toDate(), 'yyyy-MM-dd') === todayStr
                  );
                  const hasClosedQuotationsToday = quotationsForToday.length > 0 &&
                    quotationsForToday.every(q => q.status === 'Fechada' || q.status === 'Concluída');

                  if (hasClosedQuotationsToday) {
                    // Use tomorrow to start fresh - avoiding today's closed quotations
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    dateToPass = tomorrow;
                  }
                }
              }

              // Fallback if still no date
              if (!dateToPass) {
                dateToPass = new Date();
              }

              // IMPORTANTE: Se não há cotação selecionada E não há listDateForQuotation,
              // passar undefined para listId para forçar criação de nova lista vazia
              const listIdToPass = hasNoQuotationSelected && !listDateForQuotation ? undefined : listIdForQuotation;

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
            <GestaoComprasTab
              selectedQuotationId={selectedQuotationId}
              onTabChange={setActiveTab}
            />
          </TabsContent>

        </Tabs>
      </section>
    </main>
  );
}