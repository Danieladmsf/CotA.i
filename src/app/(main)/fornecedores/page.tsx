
"use client";

import * as React from "react";
import { useState, useEffect, useRef, useMemo } from "react";
import Image from "next/image";
import { MoreHorizontal, PlusCircle, Search, Upload, Download, Edit, Trash2 as DeleteIcon, Loader2, Link2, Copy, ExternalLink, UserPlus, MailX, CheckCircle, Send, KeyRound } from "lucide-react";
import Papa from "papaparse";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { db } from '@/lib/config/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, where, getDocs, serverTimestamp, writeBatch, doc, updateDoc, deleteDoc } from 'firebase/firestore';

import type { Fornecedor } from '@/types';
import AddFornecedorModal, { type FornecedorFormValues } from '@/components/features/fornecedores/AddFornecedorModal';
import { sendPortalLink } from "@/actions/notificationActions";
import { useAuth } from "@/contexts/AuthContext";


const FORNECEDORES_COLLECTION = 'fornecedores';

export default function FornecedoresPage() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [isLoadingFornecedores, setIsLoadingFornecedores] = useState(true);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [selectedSupplierForLink, setSelectedSupplierForLink] = useState<Fornecedor | null>(null);
  
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isSubmittingInvite, setIsSubmittingInvite] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  
  const [generatedLinkInfo, setGeneratedLinkInfo] = useState<{ link: string; name: string } | null>(null);
  
  const [isFornecedorModalOpen, setIsFornecedorModalOpen] = useState(false);
  const [editingFornecedor, setEditingFornecedor] = useState<Fornecedor | null>(null);
  
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [viewImage, setViewImage] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState("");

  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedSupplierForReset, setSelectedSupplierForReset] = useState<Fornecedor | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setBaseUrl(window.location.origin);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setFornecedores([]);
      setIsLoadingFornecedores(false);
      return;
    }
    setIsLoadingFornecedores(true);
    // LÓGICA DO COMPRADOR: A consulta é SEMPRE filtrada pelo ID do usuário logado.
    // Isso garante que um comprador só veja seus próprios fornecedores.
    const q = query(
      collection(db, FORNECEDORES_COLLECTION),
      where("userId", "==", user.uid),
      orderBy("empresa")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFornecedores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Fornecedor));
      setFornecedores(fetchedFornecedores);
      setIsLoadingFornecedores(false);
    }, (error) => {
      toast({ title: "Erro ao Carregar Fornecedores", description: error.message, variant: "destructive" });
      setIsLoadingFornecedores(false);
    });

    return () => unsubscribe();
  }, [toast, user]);

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  // Retorna o link único do portal para um fornecedor específico.
  // Se o fornecedor está pendente, retorna o link de registro, senão retorna o link do portal.
  const getSupplierPortalLink = (fornecedor: Fornecedor) => {
    if (!baseUrl) return "Carregando link...";
    const isPending = !fornecedor.cnpj || !fornecedor.vendedor || !fornecedor.whatsapp;
    if (isPending) {
      return `${baseUrl}/registro-fornecedor/${fornecedor.id}`;
    }
    return `${baseUrl}/portal/${fornecedor.id}`;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (!user) {
        toast({ title: "Acesso Negado", description: "Você precisa estar logado para importar fornecedores.", variant: "destructive" });
        return;
      }
      setIsLoadingFornecedores(true);
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const importedData = results.data as any[];
          if (importedData.length === 0) {
            toast({ title: "Arquivo Vazio", description: "O arquivo CSV/TXT não contém dados.", variant: "destructive" });
            setIsLoadingFornecedores(false);
            return;
          }

          const batch = writeBatch(db);
          let newFornecedoresCount = 0;
          let skippedCount = 0;

          for (const row of importedData) {
            const cnpj = String(row.CNPJ || "").trim().replace(/[^\d]/g, "");
            if (!cnpj) {
              skippedCount++;
              continue; 
            }

            const q = query(collection(db, FORNECEDORES_COLLECTION), where("cnpj", "==", cnpj), where("userId", "==", user.uid));
            const existingSnapshot = await getDocs(q);
            if (!existingSnapshot.empty) {
              skippedCount++;
              continue;
            }
            
            const fotoUrlInput = String(row.FotoUrl || "").trim();
            const fotoUrl = fotoUrlInput !== "" ? fotoUrlInput : "https://placehold.co/40x40.png";
            const fotoHint = fotoUrlInput !== "" && fotoUrlInput !== "https://placehold.co/40x40.png" ? "custom logo" : "generic logo";
            
            const newFornecedorData: Omit<Fornecedor, 'id'> = {
              empresa: String(row.Empresa || "N/A").trim(),
              cnpj: cnpj,
              vendedor: String(row.Vendedor || "N/A").trim(),
              whatsapp: String(row.WhatsApp || "N/A").trim().replace(/[^\d]/g, ""),
              fotoUrl: fotoUrl,
              fotoHint: fotoHint,
              diasDeEntrega: ['segunda', 'terca', 'quarta', 'quinta', 'sexta'], // Padrão para importação
              userId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              status: 'ativo',
            };
            const newDocRef = doc(collection(db, FORNECEDORES_COLLECTION));
            batch.set(newDocRef, newFornecedorData);
            newFornecedoresCount++;
          }

          try {
            if (newFornecedoresCount > 0) {
              await batch.commit();
            }
            let message = "";
            if (newFornecedoresCount > 0) {
              message += `${newFornecedoresCount} fornecedor(es) importado(s) com sucesso. `;
            }
            if (skippedCount > 0) {
              message += `${skippedCount} fornecedor(es) ignorado(s) (CNPJ em branco ou duplicado).`;
            }
            if (message === "") {
                message = "Nenhum fornecedor novo para importar."
            }
            toast({
              title: "Importação Concluída",
              description: message,
            });
          } catch (error: any) {
            toast({
              title: "Erro na Importação",
              description: `Ocorreu um erro ao salvar os fornecedores: ${error.message}`,
              variant: "destructive",
            });
          } finally {
            setIsLoadingFornecedores(false);
             if(event.target) event.target.value = ""; 
          }
        },
        error: (error: any) => {
          toast({
            title: "Erro na Leitura do Arquivo",
            description: `Ocorreu um erro ao ler o arquivo CSV/TXT: ${error.message}`,
            variant: "destructive",
          });
          setIsLoadingFornecedores(false);
          if(event.target) event.target.value = "";
        },
      });
    }
  };
  
  const handleNovoFornecedorClick = () => {
    setEditingFornecedor(null);
    setIsFornecedorModalOpen(true);
  };
  
  const handleEditFornecedorClick = (fornecedor: Fornecedor) => {
    setEditingFornecedor(fornecedor);
    setIsFornecedorModalOpen(true);
  };

  const handleSaveFornecedor = async (data: FornecedorFormValues) => {
    if (!user) {
      toast({ title: "Acesso Negado", description: "Você precisa estar logado para salvar um fornecedor.", variant: "destructive" });
      return;
    }
    const cleanedCnpj = data.cnpj.trim().replace(/[^\d]/g, "");
    
    const q = query(
      collection(db, FORNECEDORES_COLLECTION),
      where("cnpj", "==", cleanedCnpj),
      where("userId", "==", user.uid)
    );
    const existingSnapshot = await getDocs(q);
    const isCnpjDuplicate = !existingSnapshot.empty && existingSnapshot.docs.some(doc => doc.id !== editingFornecedor?.id);

    if (isCnpjDuplicate) {
      toast({ title: "CNPJ Duplicado", description: "Já existe outro fornecedor cadastrado com este CNPJ.", variant: "destructive" });
      return;
    }

    let fotoUrl = editingFornecedor?.fotoUrl ?? "https://placehold.co/40x40.png";
    let fotoHint = editingFornecedor?.fotoHint ?? "generic logo";

    const { fotoFile, ...dataForFirestore } = data;

    if (fotoFile) {
      try {
        toast({ title: "Fazendo upload da imagem...", description: "Aguarde um momento." });

        const uploadUrl = `/api/upload?filename=${fotoFile.name}`;

        const response = await fetch(uploadUrl, {
          method: 'POST',
          body: fotoFile,
        });

        const newBlob = await response.json();

        if (!response.ok) {
            console.error('❌ [FORNECEDORES] Response não OK:', newBlob);
            throw new Error(newBlob.message || 'Falha no upload da imagem.');
        }

        fotoUrl = newBlob.url;
        fotoHint = "custom logo";
      } catch (error: any) {
        console.error("❌ [FORNECEDORES] FALHA NO UPLOAD DA LOGO:", {
            message: error.message,
            stack: error.stack,
            fileName: fotoFile.name
        });
        toast({
          title: "Erro no Upload",
          description: error.message || "Não foi possível fazer o upload da imagem.",
          variant: "destructive",
        });
        // Continua a execução para salvar os outros dados mesmo se o upload falhar
      }
    }

    const fornecedorData = {
      empresa: dataForFirestore.empresa.trim(),
      cnpj: cleanedCnpj,
      vendedor: dataForFirestore.vendedor.trim(),
      whatsapp: dataForFirestore.whatsapp.trim().replace(/[^\d]/g, ""),
      diasDeEntrega: dataForFirestore.diasDeEntrega,
      fotoUrl,
      fotoHint,
      userId: user.uid,
      updatedAt: serverTimestamp(),
    };

    try {
      if (editingFornecedor) {
        await updateDoc(doc(db, FORNECEDORES_COLLECTION, editingFornecedor.id), fornecedorData);
        toast({ title: "Fornecedor Atualizado!", description: `O fornecedor ${data.empresa} foi atualizado.` });
      } else {
        const newFornecedorData = {
          ...fornecedorData,
          status: 'ativo' as const,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, FORNECEDORES_COLLECTION), newFornecedorData);
        toast({ title: "Fornecedor Adicionado!", description: `O fornecedor ${data.empresa} foi criado.` });
      }
    } catch (error: any) {
      toast({ title: "Erro ao Salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsFornecedorModalOpen(false);
      setEditingFornecedor(null);
    }
  };

  const handleDeleteFornecedor = async (id: string, nome: string) => {
    // Confirmação antes de excluir
    const confirmar = window.confirm(`Tem certeza que deseja excluir o fornecedor "${nome}"?\n\nEsta ação não pode ser desfeita.`);

    if (!confirmar) {
      return;
    }

    try {
      // Excluir o documento do fornecedor
      await deleteDoc(doc(db, FORNECEDORES_COLLECTION, id));

      toast({
        title: "Fornecedor Excluído",
        description: `O fornecedor ${nome} foi excluído com sucesso.`,
      });
    } catch (error: any) {
      console.error("Erro ao excluir fornecedor:", error);
      toast({
        title: "Erro ao Excluir",
        description: error.message || "Não foi possível excluir o fornecedor.",
        variant: "destructive",
      });
    }
  };

  // Hash function for PIN (same as registration page)
  const hashPin = async (pin: string): Promise<string> => {
    try {
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

    // Fallback hash
    let hash = 0;
    for (let i = 0; i < pin.length; i++) {
      const char = pin.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  };

  const handleOpenResetPassword = (fornecedor: Fornecedor) => {
    setSelectedSupplierForReset(fornecedor);
    setNewPassword("");
    setResetPasswordModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedSupplierForReset) return;

    if (!newPassword || newPassword.length < 4 || newPassword.length > 6) {
      toast({
        title: "Senha Inválida",
        description: "A senha deve ter entre 4 e 6 dígitos numéricos.",
        variant: "destructive",
      });
      return;
    }

    if (!/^\d{4,6}$/.test(newPassword)) {
      toast({
        title: "Senha Inválida",
        description: "A senha deve conter apenas números.",
        variant: "destructive",
      });
      return;
    }

    setIsResettingPassword(true);

    try {
      const hashedPin = await hashPin(newPassword);
      const docRef = doc(db, FORNECEDORES_COLLECTION, selectedSupplierForReset.id);

      await updateDoc(docRef, {
        pin: hashedPin,
        updatedAt: serverTimestamp(),
      });

      toast({
        title: "Senha Redefinida!",
        description: `A senha de ${selectedSupplierForReset.empresa} foi redefinida com sucesso.`,
      });

      setResetPasswordModalOpen(false);
      setNewPassword("");
      setSelectedSupplierForReset(null);
    } catch (error: any) {
      console.error("Erro ao redefinir senha:", error);
      toast({
        title: "Erro ao Redefinir Senha",
        description: error.message || "Não foi possível redefinir a senha.",
        variant: "destructive",
      });
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleExportFornecedores = () => {
    if (fornecedores.length === 0) {
      toast({ title: "Nada para Exportar", description: "Não há fornecedores para exportar.", variant: "destructive" });
      return;
    }
    const csvData = fornecedores.map(f => ({
      "Empresa": f.empresa,
      "CNPJ": f.cnpj,
      "Vendedor": f.vendedor,
      "WhatsApp": f.whatsapp,
      "FotoUrl": f.fotoUrl,
      "DiasDeEntrega": f.diasDeEntrega?.join(',') || ''
    }));
    const csvString = Papa.unparse(csvData, { header: true });
    const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `fornecedores_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Exportação Concluída", description: "Sua lista de fornecedores foi salva como um arquivo .csv" });
  };

  const handleOpenLinkModal = (fornecedor: Fornecedor) => {
    console.log('Opening link modal for:', fornecedor);
    console.log('isLinkModalOpen state before setting:', isLinkModalOpen);
    setSelectedSupplierForLink(fornecedor);
    setIsLinkModalOpen(true);
    console.log('isLinkModalOpen state after setting:', true);
  };

  const handleSendLinkViaWhatsApp = async (supplier: Fornecedor, link: string) => {
    if (!supplier.whatsapp) {
        toast({ title: "WhatsApp não encontrado", description: "Este fornecedor não possui um número de WhatsApp cadastrado.", variant: "destructive" });
        return;
    }
    setIsSendingLink(true);
    const result = await sendPortalLink(supplier, link);
    if (result.success) {
        toast({ title: "Mensagem Enfileirada!", description: "O link do portal foi enviado para a fila de envio do WhatsApp." });
        setIsLinkModalOpen(false);
    } else {
        toast({ title: "Erro ao Enviar", description: result.error || "Não foi possível enfileirar a mensagem.", variant: "destructive" });
    }
    setIsSendingLink(false);
  };


  const handleCopyLink = (link: string) => {
    // Check if the Clipboard API is supported
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(link)
        .then(() => {
          toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
          // Fechar ambos os modais após pequeno delay para garantir que o toast apareça
          setTimeout(() => {
            setIsLinkModalOpen(false);
            setGeneratedLinkInfo(null);
          }, 300);
        })
        .catch(err => {
          fallbackCopyTextToClipboard(link);
        });
    } else {
      // Fallback for browsers that don't support the Clipboard API
      fallbackCopyTextToClipboard(link);
    }
  };

  const fallbackCopyTextToClipboard = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.position = "fixed";
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.width = "2em";
    textArea.style.height = "2em";
    textArea.style.padding = "0";
    textArea.style.border = "none";
    textArea.style.outline = "none";
    textArea.style.boxShadow = "none";
    textArea.style.background = "transparent";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      const successful = document.execCommand('copy');
      if (successful) {
        toast({ title: "Link Copiado!", description: "O link foi copiado para a área de transferência." });
        // Fechar ambos os modais após pequeno delay para garantir que o toast apareça
        setTimeout(() => {
          setIsLinkModalOpen(false);
          setGeneratedLinkInfo(null);
        }, 300);
      } else {
        toast({
          title: "Use Ctrl+V para colar",
          description: "Este navegador não suporta a API de clipboard. Use **Ctrl+V** para colar.",
          variant: "default"
        });
      }
    } catch (err) {
      toast({
        title: "Use Ctrl+V para colar",
        description: "Este navegador não suporta a API de clipboard. Use **Ctrl+V** para colar.",
        variant: "default"
      });
    } finally {
      document.body.removeChild(textArea);
    }
  };

  const handleOpenLinkInNewTab = (link: string) => {
      window.open(link, '_blank');
      setIsLinkModalOpen(false);
  };

  const handleGenerateInvite = async () => {
    if (!user) {
        toast({ title: "Acesso Negado", description: "Você precisa estar logado para criar um convite.", variant: "destructive" });
        return;
    }
    if (!newSupplierName.trim()) {
        toast({ title: "Nome obrigatório", description: "Por favor, insira o nome da empresa.", variant: "destructive" });
        return;
    }
    setIsSubmittingInvite(true);
    try {
        const newFornecedorData = {
            empresa: newSupplierName.trim(),
            status: 'pendente',
            cnpj: '',
            vendedor: '',
            whatsapp: '',
            diasDeEntrega: [],
            fotoUrl: 'https://placehold.co/40x40.png',
            fotoHint: 'generic logo',
            userId: user.uid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, FORNECEDORES_COLLECTION), newFornecedorData);
        
        setGeneratedLinkInfo({
          link: `${baseUrl}/registro-fornecedor/${docRef.id}`,
          name: newSupplierName.trim()
        });
        
        setIsInviteModalOpen(false);
        setNewSupplierName("");
        toast({ title: "Convite criado!", description: "A linha de cadastro pendente foi adicionada à tabela." });

    } catch (error: any) {
        toast({ title: "Erro ao criar convite", description: error.message, variant: "destructive" });
    } finally {
        setIsSubmittingInvite(false);
    }
  };

  const filteredFornecedores = useMemo(() => 
    fornecedores.filter((fornecedor) =>
      fornecedor.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (fornecedor.cnpj && fornecedor.cnpj.includes(searchTerm)) ||
      (fornecedor.vendedor && fornecedor.vendedor.toLowerCase().includes(searchTerm.toLowerCase()))
    ), [fornecedores, searchTerm]);
  
  const isValidImageUrl = (url?: string): url is string => {
    return !!url && (url.startsWith('http') || url.startsWith('data:'));
  };

  return (
    <main className="w-full space-y-8" role="main">
      <section className="card-professional modern-shadow-xl hover-lift" aria-labelledby="fornecedores-section">
        <header className="p-6 md:p-8 border-b header-modern">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por empresa, CNPJ ou vendedor..."
                className="pl-10 w-full input-modern text-base"
                value={searchTerm}
                onChange={handleSearch}
                disabled={isLoadingFornecedores && fornecedores.length === 0}
                aria-label="Buscar fornecedores"
              />
            </div>
          </div>
          
          <nav className="mt-6" aria-label="Ações de fornecedores">
            <div className="flex flex-wrap gap-3">
              <input
                type="file"
                accept=".csv,.txt"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
              />
              <Button 
                variant="outline" 
                onClick={handleImportButtonClick} 
                className="flex items-center gap-2 px-4 py-2 hover-lift transition-all duration-200" 
                disabled={isLoadingFornecedores}
                aria-label="Importar fornecedores via CSV ou TXT"
              >
                {isLoadingFornecedores && fileInputRef.current?.files && fileInputRef.current.files.length > 0 ? 
                  <Loader2 className="h-5 w-5 animate-spin" /> : 
                  <Upload className="h-5 w-5 rotate-hover" />
                }
                <span className="font-medium">Importar</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={handleExportFornecedores} 
                className="flex items-center gap-2 px-4 py-2 hover-lift transition-all duration-200" 
                disabled={fornecedores.length === 0}
                aria-label="Exportar lista de fornecedores"
              >
                <Download className="h-5 w-5 rotate-hover" />
                <span className="font-medium">Exportar</span>
              </Button>
              
              <Button 
                variant="outline" 
                onClick={() => setIsInviteModalOpen(true)} 
                className="flex items-center gap-2 px-4 py-2 hover-lift transition-all duration-200"
                aria-label="Convidar novo fornecedor"
              >
                <UserPlus className="h-5 w-5 rotate-hover" />
                <span className="font-medium">Convidar</span>
              </Button>
              
              <Button 
                onClick={handleNovoFornecedorClick} 
                className="flex items-center gap-2 px-6 py-2 button-modern font-semibold" 
                disabled={isLoadingFornecedores}
                aria-label="Adicionar novo fornecedor"
              >
                <PlusCircle className="h-5 w-5 rotate-hover" />
                <span>Novo Fornecedor</span>
              </Button>
            </div>
          </nav>
        </header>
        
        <div className="p-0" role="region" aria-label="Lista de fornecedores">
          <div className="rounded-md border-t">
            <Table className="table-modern">
              <TableHeader>
                <TableRow className="slide-in-right">
                  <TableHead className="w-[60px] pl-6" scope="col">
                    <span className="sr-only">Foto do fornecedor</span>
                    Foto
                  </TableHead>
                  <TableHead scope="col" className="font-heading font-semibold">
                    Empresa
                  </TableHead>
                  <TableHead scope="col" className="hidden md:table-cell font-heading font-semibold">
                    CNPJ
                  </TableHead>
                  <TableHead scope="col" className="hidden lg:table-cell font-heading font-semibold">
                    Vendedor
                  </TableHead>
                  <TableHead scope="col" className="hidden sm:table-cell font-heading font-semibold">
                    WhatsApp
                  </TableHead>
                  <TableHead scope="col" className="text-center w-[80px] font-heading font-semibold">
                    Portal
                  </TableHead>
                  <TableHead scope="col" className="text-right w-[80px] pr-6 font-heading font-semibold">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingFornecedores ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      <div className="flex justify-center items-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary mr-2" />
                        Carregando fornecedores...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredFornecedores.length > 0 ? (
                  filteredFornecedores.map((fornecedor) => {
                    const isPending = fornecedor.status === 'pendente';
                    const imageUrl = isValidImageUrl(fornecedor.fotoUrl) ? fornecedor.fotoUrl : 'https://placehold.co/40x40.png';
                    return (
                      <TableRow key={fornecedor.id} className={`table-row-modern ${isPending ? "bg-muted/30 opacity-70" : ""}`}>
                        <TableCell className="pl-4 md:pl-6">
                          <button onClick={() => setViewImage(imageUrl)} className="rounded-full overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2">
                            <Avatar className="h-10 w-10 scale-hover">
                              <Image src={imageUrl} alt={fornecedor.empresa} width={40} height={40} className="object-cover" data-ai-hint={fornecedor.fotoHint} />
                              <AvatarFallback>
                                {fornecedor.empresa.substring(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                          </button>
                        </TableCell>
                        <TableCell className="font-medium">
                          {fornecedor.empresa}
                          {isPending && <Badge variant="secondary" className="ml-2 font-normal pulse-glow">Pendente</Badge>}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">{fornecedor.cnpj || "N/A"}</TableCell>
                        <TableCell className="hidden lg:table-cell">{fornecedor.vendedor || "N/A"}</TableCell>
                        <TableCell className="hidden sm:table-cell">{fornecedor.whatsapp || "N/A"}</TableCell>
                        <TableCell className="text-center">
                          <Button variant="ghost" size="icon" onClick={() => handleOpenLinkModal(fornecedor)} className="hover-lift">
                             <Link2 className="h-5 w-5 text-primary rotate-hover" />
                            <span className="sr-only">Link do Portal</span>
                          </Button>
                        </TableCell>
                        <TableCell className="text-right pr-4 md:pr-6">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="hover-lift">
                                <MoreHorizontal className="h-5 w-5 rotate-hover" />
                                <span className="sr-only">Ações</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="card-professional">
                              <DropdownMenuItem onClick={() => handleEditFornecedorClick(fornecedor)} className="hover-lift">
                                  <Edit className="mr-2 h-4 w-4" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleOpenResetPassword(fornecedor)} className="hover-lift">
                                  <KeyRound className="mr-2 h-4 w-4" /> Redefinir Senha
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleDeleteFornecedor(fornecedor.id, fornecedor.empresa)} className="text-destructive hover:!bg-destructive hover:!text-destructive-foreground hover-lift">
                                  <DeleteIcon className="mr-2 h-4 w-4" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {searchTerm ? "Nenhum fornecedor encontrado para sua busca." : "Nenhum fornecedor cadastrado."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </section>

      {isFornecedorModalOpen && (
        <AddFornecedorModal
          isOpen={isFornecedorModalOpen}
          onClose={() => setIsFornecedorModalOpen(false)}
          onSave={handleSaveFornecedor}
          fornecedor={editingFornecedor}
        />
      )}

      {isLinkModalOpen && selectedSupplierForLink && (() => {
        const isPending = !selectedSupplierForLink.cnpj || !selectedSupplierForLink.vendedor || !selectedSupplierForLink.whatsapp;
        return (
          <Dialog open={isLinkModalOpen} onOpenChange={setIsLinkModalOpen}>
            <DialogContent>
              <div className="card-professional modern-shadow-xl p-6 space-y-4">
                <DialogHeader className="fade-in text-center">
                  <DialogTitle className="text-gradient">
                    {isPending ? 'Link de Convite Gerado!' : 'Link de Acesso ao Portal'}
                  </DialogTitle>
                  <DialogDescription>
                    {isPending
                      ? `Envie este link para ${selectedSupplierForLink.empresa} para que completem o cadastro.`
                      : `Envie este link para o fornecedor ${selectedSupplierForLink.empresa} para que ele possa acessar o portal de cotações.`
                    }
                  </DialogDescription>
                </DialogHeader>
              <div className="flex items-center space-x-2 slide-in-up">
                <Input
                  id="link"
                  value={getSupplierPortalLink(selectedSupplierForLink)}
                  readOnly
                  className="input-modern"
                />
              </div>
              <DialogFooter className="slide-in-up grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Button
                  onClick={() => handleSendLinkViaWhatsApp(selectedSupplierForLink, getSupplierPortalLink(selectedSupplierForLink))}
                  disabled={isSendingLink || !baseUrl || !selectedSupplierForLink.whatsapp}
                  className="w-full button-modern"
                >
                  {isSendingLink ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4 rotate-hover" />}
                  WhatsApp
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleCopyLink(getSupplierPortalLink(selectedSupplierForLink))}
                  disabled={!baseUrl}
                >
                  <Copy className="mr-2 h-4 w-4 rotate-hover" />
                  Copiar Link
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOpenLinkInNewTab(getSupplierPortalLink(selectedSupplierForLink))}
                  disabled={!baseUrl}
                >
                  <ExternalLink className="mr-2 h-4 w-4 rotate-hover" />
                  Abrir Link
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
        );
      })()}

      <Dialog open={isInviteModalOpen} onOpenChange={setIsInviteModalOpen}>
          <DialogContent>
            <div className="card-professional modern-shadow-xl">
              <DialogHeader className="fade-in">
                  <DialogTitle className="text-gradient">Convidar Novo Fornecedor</DialogTitle>
                  <DialogDescription>
                      Insira o nome da empresa para criar um convite de cadastro pendente.
                  </DialogDescription>
              </DialogHeader>
              <div className="space-y-2 slide-in-up">
                  <label htmlFor="new-supplier-name">Nome da Empresa *</label>
                  <Input 
                      id="new-supplier-name" 
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      placeholder="Ex: Novo Fornecedor Inc."
                      className="input-modern"
                  />
              </div>
              <DialogFooter className="slide-in-up">
                  <Button variant="outline" onClick={() => setIsInviteModalOpen(false)} className="transition-colors">Cancelar</Button>
                  <Button onClick={handleGenerateInvite} disabled={isSubmittingInvite} className="button-modern">
                      {isSubmittingInvite && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      Gerar Link de Convite
                  </Button>
              </DialogFooter>
            </div>
          </DialogContent>
      </Dialog>
      
      <Dialog open={!!generatedLinkInfo} onOpenChange={() => setGeneratedLinkInfo(null)}>
        <DialogContent>
          <div className="sm:max-w-md card-professional modern-shadow-xl">
            <DialogHeader className="fade-in">
              <DialogTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5 pulse-glow" />
                Link de Convite Gerado!
              </DialogTitle>
              <DialogDescription>
                Envie este link para <span className="font-semibold">{generatedLinkInfo?.name}</span> para que completem o cadastro.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center space-x-2 mt-2 slide-in-up">
              <Input
                value={generatedLinkInfo?.link || ""}
                readOnly
                className="input-modern"
              />
              <Button type="button" size="icon" variant="outline" onClick={() => handleCopyLink(generatedLinkInfo?.link || '')} className="transition-colors">
                <Copy className="h-4 w-4 rotate-hover" />
                <span className="sr-only">Copiar link</span>
              </Button>
            </div>
            <DialogFooter className="sm:justify-start mt-4 slide-in-up">
              <Button type="button" variant="secondary" onClick={() => setGeneratedLinkInfo(null)} className="transition-colors">
                  Fechar
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!viewImage} onOpenChange={() => setViewImage(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Visualização Ampliada</DialogTitle>
            <DialogDescription className="sr-only">
              Imagem ampliada do logo do fornecedor.
            </DialogDescription>
          </DialogHeader>
          <div className="max-w-3xl p-0">
            <img src={viewImage || ''} alt="Visualização Ampliada" className="w-full h-auto rounded-lg" />
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de Redefinir Senha */}
      <Dialog open={resetPasswordModalOpen} onOpenChange={setResetPasswordModalOpen}>
        <DialogContent>
          <div className="card-professional modern-shadow-xl">
            <DialogHeader className="fade-in">
              <DialogTitle className="flex items-center gap-2 text-gradient">
                <KeyRound className="h-5 w-5" />
                Redefinir Senha
              </DialogTitle>
              <DialogDescription>
                Digite uma nova senha de 4 a 6 dígitos numéricos para <span className="font-semibold">{selectedSupplierForReset?.empresa}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 mt-4 slide-in-up">
              <div>
                <label htmlFor="new-password" className="block text-sm font-medium mb-2">
                  Nova Senha *
                </label>
                <Input
                  id="new-password"
                  type="password"
                  inputMode="numeric"
                  placeholder="Digite 4-6 números"
                  maxLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-modern text-center text-2xl tracking-widest"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  A senha será hasheada e armazenada de forma segura.
                </p>
              </div>
            </div>
            <DialogFooter className="slide-in-up mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setResetPasswordModalOpen(false);
                  setNewPassword("");
                }}
                disabled={isResettingPassword}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleResetPassword}
                disabled={isResettingPassword}
                className="button-modern"
              >
                {isResettingPassword && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Redefinir Senha
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

    </main>
  );
}
