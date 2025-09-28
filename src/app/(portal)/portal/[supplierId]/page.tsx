
"use client";

import React, { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Building, Clock, FileText, Settings } from 'lucide-react';
import { db } from '@/lib/config/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import type { Quotation, Fornecedor } from '@/types';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useToast } from "@/hooks/use-toast";
import { Badge } from '@/components/ui/badge';
import AddFornecedorModal, { FornecedorFormValues } from '@/components/features/fornecedores/AddFornecedorModal';

const QUOTATIONS_COLLECTION = "quotations";
const FORNECEDORES_COLLECTION = "fornecedores";

const getQuotationCardStyle = (status: Quotation['status']) => {
    switch (status) {
        case 'Aberta':
            return {
                headerClass: 'bg-green-600 text-green-50',
                badgeClass: 'bg-white/20 border-white/30 text-white'
            };
        case 'Pausada':
            return {
                headerClass: 'bg-amber-500 text-amber-50',
                badgeClass: 'bg-white/20 border-white/30 text-white'
            };
        case 'Fechada':
        case 'Concluída':
            return {
                headerClass: 'bg-orange-500 text-orange-50',
                badgeClass: 'bg-white/20 border-white/30 text-white'
            };
        default:
            return {
                headerClass: 'bg-gray-500 text-gray-50',
                badgeClass: 'bg-white/20 border-white/30 text-white'
            };
    }
};


export default function SupplierPortalPage() {
  const router = useRouter();
  const params = useParams();
  const supplierId = params.supplierId as string;
  const { toast } = useToast();

  const [supplier, setSupplier] = useState<Fornecedor | null>(null);
  const [openQuotations, setOpenQuotations] = useState<Quotation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    if (!supplierId) {
      setIsLoading(false);
      toast({
        title: "Erro",
        description: "ID do fornecedor ausente.",
        variant: "destructive"
      });
      return;
    }

    const supplierDocRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
    const unsubSupplier = onSnapshot(supplierDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const supplierData = { id: docSnap.id, ...docSnap.data() } as Fornecedor;
        setSupplier(supplierData);
      } else {
        setSupplier(null);
        toast({
          title: "Fornecedor Não Encontrado",
          description: "O ID do fornecedor é inválido ou não existe.",
          variant: "destructive"
        });
      }
    }, (error) => {
      console.error("Error fetching supplier:", error);
      toast({
        title: "Erro ao Carregar Fornecedor",
        description: error.message,
        variant: "destructive"
      });
      setSupplier(null);
    });

    const quotationsQuery = query(
        collection(db, "quotations"), 
        where("supplierIds", "array-contains", supplierId),
        where("status", "in", ["Aberta", "Pausada", "Fechada", "Concluída"]), 
        orderBy("deadline", "desc")
    );
    const unsubQuotations = onSnapshot(quotationsQuery, async (querySnapshot) => {
      const fetchedQuotations = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Quotation));
      
      // Check for expired quotations and update their status
      const currentTime = new Date();
      const quotationsToUpdate = fetchedQuotations.filter(quotation => 
        quotation.status === 'Aberta' && 
        quotation.deadline && 
        quotation.deadline.toDate() <= currentTime
      );

      // Close expired quotations
      for (const expiredQuotation of quotationsToUpdate) {
        try {
          console.log(`[Portal] Auto-closing expired quotation ${expiredQuotation.id}`);
          const quotationRef = doc(db, "quotations", expiredQuotation.id);
          await updateDoc(quotationRef, { status: "Fechada" });
        } catch (error) {
          console.error(`Failed to close expired quotation ${expiredQuotation.id}:`, error);
        }
      }

      setOpenQuotations(fetchedQuotations);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching open quotations:", error.message, error.stack);
      toast({
        title: "Erro ao buscar cotações",
        description: error.message,
        variant: "destructive"
      });
      setIsLoading(false);
    });

    return () => {
      unsubSupplier();
      unsubQuotations();
    };
  }, [supplierId, toast]);

  const handleUpdateSupplier = async (data: FornecedorFormValues) => {
    if (!supplierId) return;
    try {
      const supplierRef = doc(db, FORNECEDORES_COLLECTION, supplierId);
      await updateDoc(supplierRef, data);
      toast({
        title: "Sucesso",
        description: "Seus dados foram atualizados.",
        variant: "default",
      });
      setIsModalOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-muted-foreground">Carregando portal do fornecedor...</p>
      </div>
    );
  }

  if (!supplier) {
     return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4">
        <Building className="h-12 w-12 text-destructive mb-4" />
        <h1 className="text-2xl font-bold text-destructive mb-2">Acesso ao Portal Falhou</h1>
        <p className="text-muted-foreground text-center">Não foi possível carregar os dados do fornecedor ou o fornecedor não foi encontrado.</p>
        <Button onClick={() => router.push('/')} className="mt-6">Voltar para Home</Button>
      </div>
    );
  }

  return (
    <>
      <div className="container mx-auto p-4 md:p-6 lg:p-8 min-h-screen bg-background">
        <header className="mb-8 text-center md:text-left">
          <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2">Portal do Fornecedor</h1>
          <div className="flex items-center justify-center md:justify-start gap-2">
            <p className="text-xl text-foreground">Bem-vindo(a), {supplier.empresa}!</p>
            <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(true)}>
              <Settings className="h-6 w-6 text-muted-foreground hover:text-foreground transition-colors" />
            </Button>
          </div>
          <p className="text-md text-muted-foreground">Aqui você pode visualizar e responder às cotações abertas.</p>
        </header>

        {openQuotations.length === 0 ? (
          <Card className="shadow-lg text-center">
            <CardHeader>
              <CardTitle>Nenhuma Cotação Encontrada</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Nenhuma cotação foi encontrada para você no momento. Cotações em que você for convidado aparecerão aqui.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-semibold text-foreground">Cotações Recentes ({openQuotations.length})</h2>
            {openQuotations.map((quotation) => {
              const style = getQuotationCardStyle(quotation.status);
              const now = new Date();
              const isExpired = quotation.deadline && quotation.deadline.toDate() <= now;
              const actualStatus = (quotation.status === 'Aberta' && isExpired) ? 'Fechada' : quotation.status;
              
              return(
                  <Card key={quotation.id} className="shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden">
                      <CardHeader className={`p-0 ${style.headerClass}`}>
                          <div className="p-6">
                              <CardTitle className="text-xl flex items-center justify-between">
                                  <span>
                                      Cotação para Entrega em: {format(quotation.shoppingListDate.toDate(), "dd/MM/yyyy", { locale: ptBR })}
                                  </span>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className={style.badgeClass}>{actualStatus}</Badge>
                                    {isExpired && quotation.status === 'Aberta' && (
                                      <Badge variant="destructive" className="text-xs">
                                        Expirada
                                      </Badge>
                                    )}
                                  </div>
                              </CardTitle>
                          </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-3">
                          <div className="flex items-center text-muted-foreground">
                              <Clock className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span>Prazo final para envio: <span className="font-semibold text-foreground">{format(quotation.deadline.toDate(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span></span>
                              {isExpired && (
                                <Badge variant="outline" className="ml-2 text-xs text-destructive border-destructive">
                                  Expirado
                                </Badge>
                              )}
                          </div>
                          <div className="flex items-center text-muted-foreground text-sm">
                              <FileText className="h-4 w-4 mr-2 flex-shrink-0" />
                              <span className="truncate">Ref ID: {quotation.id}</span>
                          </div>
                      </CardContent>
                      <CardFooter className="bg-muted/50 p-4 border-t">
                          <Button asChild className="w-full md:w-auto ml-auto" variant={actualStatus === 'Aberta' ? 'default' : 'secondary'}>
                              <Link href={`/portal/${supplierId}/cotar/${quotation.id}`}>
                                  {actualStatus === 'Aberta' ? 'Visualizar e Cotar' : 'Ver Resultado'} <ArrowRight className="ml-2 h-4 w-4" />
                              </Link>
                          </Button>
                      </CardFooter>
                  </Card>
              )
            })}
          </div>
        )}
      </div>
      {isModalOpen && (
        <AddFornecedorModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSave={handleUpdateSupplier}
          fornecedor={supplier}
        />
      )}
    </>
  );
}
