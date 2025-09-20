
"use client";

import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Wifi, WifiOff, QrCode, Clock, AlertTriangle, Send, CloudCog, CheckCircle } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription as AlertPrimitiveDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipProvider, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { db } from '@/lib/config/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { useAuth } from "@/contexts/AuthContext";
import type { WhatsAppStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const USER_SESSIONS_COLLECTION = 'user_sessions';
const REQUEST_TIMEOUT_MS = 30000;

const isQrCodeExpired = (timestamp: any): boolean => {
    if (!timestamp) return true;
    let qrDate: Date;
    // Handle both Firestore Timestamp and ISO string formats
    if (timestamp.toDate) {
        qrDate = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
        qrDate = new Date(timestamp);
    } else {
        return true; // Invalid format
    }
    if (isNaN(qrDate.getTime())) return true;
    const diffInSeconds = (new Date().getTime() - qrDate.getTime()) / 1000;
    return diffInSeconds > 60; // QR codes from whatsapp-web.js usually last about a minute
};

function StatusIndicator({ status, lastConnectedAt }: { status: WhatsAppStatus['status'] | null | undefined, lastConnectedAt?: Timestamp | string }) {
  if (!status) {
    return <Badge variant="outline">Indisponível</Badge>;
  }

  const formatLastConnected = (timestamp?: Timestamp | string) => {
    if (!timestamp) return 'nunca';
    
    let dateToShow: Date;
    if (typeof timestamp === 'string') {
        dateToShow = new Date(timestamp);
    } else if (timestamp && 'toDate' in timestamp) {
        dateToShow = timestamp.toDate();
    } else {
        return 'data inválida';
    }

    if (isNaN(dateToShow.getTime())) return 'data inválida';
    
    return formatDistanceToNow(dateToShow, { addSuffix: true, locale: ptBR });
  };
  
  switch (status) {
    case 'connected':
      return <Badge variant="default" className="bg-green-600 hover:bg-green-700"><CheckCircle className="h-4 w-4 mr-2" />Conectado</Badge>;
    case 'needs_qr':
      return <Badge variant="destructive"><QrCode className="h-4 w-4 mr-2" />Aguardando QR Code</Badge>;
    case 'initializing':
    case 'creating':
    case 'authenticated':
      return <Badge variant="secondary"><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sincronizando...</Badge>;
    case 'disconnected':
    default:
      return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                 <Badge variant="outline"><WifiOff className="h-4 w-4 mr-2" />Desconectado</Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>Última conexão: {formatLastConnected(lastConnectedAt)}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
      );
  }
}


export default function WhatsAppAdminPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [waStatus, setWaStatus] = useState<WhatsAppStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestTimedOut, setRequestTimedOut] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isSettingCors, setIsSettingCors] = useState(false);

  useEffect(() => {
    if (!user) {
        setIsLoadingStatus(false);
        return;
    }
    
    setIsLoadingStatus(true);
    // Point directly to the user's session document
    const statusDocRef = doc(db, USER_SESSIONS_COLLECTION, user.uid);
    
    const unsubscribe = onSnapshot(statusDocRef, (docSnap) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setRequestTimedOut(false);
      setIsRequesting(false);

      if (docSnap.exists()) {
        const data = docSnap.data();
        // Map fields from user_sessions document to WhatsAppStatus type
        const newStatus: WhatsAppStatus = {
          status: data.status || 'disconnected',
          qrDataUri: data.qrCode || null,
          generatedAt: data.generatedAt,
          readyAt: data.connectedAt || data.readyAt, // Use 'connectedAt' if available
          disconnectedAt: data.disconnectedAt,
          error: data.error,
        };
        setWaStatus(newStatus);
      } else {
        // If the user has no session document, they are disconnected
        setWaStatus({ status: 'disconnected' });
      }
      
      setIsLoadingStatus(false);
    }, (error) => {
      console.error("Error fetching WhatsApp status:", error);
      toast({ title: "Erro de Conexão", description: "Não foi possível obter o status do WhatsApp.", variant: "destructive" });
      setIsLoadingStatus(false);
    });

    return () => {
      unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [user, toast]);
  
  const handleSetupCors = async () => {
    setIsSettingCors(true);
    try {
      const response = await fetch('/api/setup-cors', {
        method: 'POST',
      });
      const result = await response.json();
      if (response.ok) {
        toast({
          title: 'Sucesso!',
          description: result.message || 'As permissões de CORS foram configuradas com sucesso. Os uploads devem funcionar agora.',
          variant: 'default',
        });
      } else {
        throw new Error(result.error || 'Falha ao configurar o CORS.');
      }
    } catch (error: any) {
      toast({
        title: 'Erro ao Configurar CORS',
        description: error.message || 'Ocorreu um erro desconhecido.',
        variant: 'destructive',
      });
    } finally {
      setIsSettingCors(false);
    }
  };

  const handleRequestConnection = async () => {
    if (!user) {
        toast({ title: "Erro", description: "Usuário não autenticado.", variant: "destructive" });
        return;
    }
    
    setRequestTimedOut(false);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setIsRequesting(true);
    const requestDocRef = doc(db, USER_SESSIONS_COLLECTION, user.uid);
    
    const requestPayload = {
        status: 'create_requested',
        requestedAt: serverTimestamp(),
        userId: user.uid,
    };

    try {
        await setDoc(requestDocRef, requestPayload, { merge: true });
        toast({
            title: "Solicitação Enviada!",
            description: "Aguardando resposta da sua ponte local para gerar o QR Code.",
        });

        timeoutRef.current = setTimeout(() => {
          setRequestTimedOut(true);
          setIsRequesting(false);
        }, REQUEST_TIMEOUT_MS);

    } catch (error) {
        console.error("Error creating session request:", error);
        toast({ title: "Erro ao Solicitar", description: "Não foi possível enviar a solicitação.", variant: "destructive" });
        setIsRequesting(false);
    }
  };
  
  const renderStatusContent = () => {
      if (!user) {
        return (
          <Alert variant="destructive">
              <WifiOff className="h-5 w-5" />
              <AlertTitle className="font-semibold">Usuário não encontrado</AlertTitle>
              <AlertPrimitiveDescription>
                  Você precisa estar logado para configurar a conexão com o WhatsApp.
              </AlertPrimitiveDescription>
          </Alert>
        );
      }

      if (isLoadingStatus) {
          return (
            <div className="flex flex-col items-center justify-center p-8 text-muted/30 rounded-lg min-h-[150px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Obtendo status da ponte de conexão...</p>
            </div>
          );
      }
      
      if (requestTimedOut) {
          return (
            <Alert variant="destructive">
                <Clock className="h-5 w-5" />
                <AlertTitle className="font-semibold">Tempo de Solicitação Esgotado</AlertTitle>
                <AlertPrimitiveDescription>
                    A plataforma enviou um sinal, mas a sua ponte local do WhatsApp não respondeu a tempo.
                    <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>Verifique se o script `whatsapp-bridge` está rodando na sua máquina local.</li>
                        <li>Confirme se não há erros no console do terminal onde a ponte está rodando.</li>
                    </ul>
                </AlertPrimitiveDescription>
                 <Button onClick={handleRequestConnection} className="mt-4 button-modern" disabled={isRequesting}>
                    {isRequesting ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Send className="mr-2 h-4 w-4" /> )}
                    Tentar Novamente
                </Button>
            </Alert>
          );
      }

      if (waStatus?.error) {
          return (
            <Alert variant="destructive">
                <AlertTriangle className="h-5 w-5" />
                <AlertTitle className="font-semibold">Erro na Ponte Local do WhatsApp</AlertTitle>
                <AlertPrimitiveDescription>
                    <p className="mb-2">O script local encontrou um erro ao tentar iniciar a sessão.</p>
                    <p className="font-semibold mb-1">Mensagem de Erro:</p>
                    <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm break-words">
                        {waStatus.error}
                    </code>
                    <p className="mt-3 text-xs">
                        Este erro geralmente indica um problema com o ambiente de execução na sua máquina local. Verifique os logs do terminal da ponte para mais detalhes.
                    </p>
                </AlertPrimitiveDescription>
            </Alert>
          );
      }
      
      if (waStatus?.status === 'authenticated' || waStatus?.status === 'creating' || waStatus?.status === 'initializing') {
          return (
            <Alert variant="default" className="bg-blue-50 border-blue-200 text-blue-900 shadow-md">
                <Loader2 className="h-5 w-5 text-blue-700 animate-spin" />
                <AlertTitle className="font-semibold text-blue-800">Autenticado! Sincronizando...</AlertTitle>
                <AlertPrimitiveDescription className="text-blue-800/90">
                    A conexão foi autenticada com sucesso. A ponte está sincronizando os dados e preparando a sessão. Por favor, aguarde um momento.
                </AlertPrimitiveDescription>
            </Alert>
          );
      }

      if (waStatus?.status === 'connected') {
          return (
            <Alert variant="default" className="bg-green-50 border-green-200 text-green-900 shadow-md">
                <Wifi className="h-5 w-5 text-green-700" />
                <AlertTitle className="font-semibold text-green-800">Conectado!</AlertTitle>
                <AlertPrimitiveDescription className="text-green-800/90">
                    Sua ponte com o WhatsApp está ativa e pronta para o envio de notificações. Se a conexão cair, clique no botão abaixo para solicitar uma nova conexão.
                </AlertPrimitiveDescription>
                 <Button onClick={handleRequestConnection} className="mt-4 button-modern" disabled={isRequesting}>
                    <QrCode className="mr-2 h-4 w-4" />
                    Gerar Novo QR Code (se necessário)
                </Button>
            </Alert>
          );
      }
      
      if (waStatus?.status === 'needs_qr' && waStatus.qrDataUri) {
          const isExpired = isQrCodeExpired(waStatus.generatedAt);
          if (isExpired) {
            return (
                <Alert variant="destructive">
                    <Clock className="h-5 w-5" />
                    <AlertTitle className="font-semibold">QR Code Expirado</AlertTitle>
                    <AlertPrimitiveDescription>
                        O QR Code anterior expirou. Clique abaixo para solicitar um novo.
                    </AlertPrimitiveDescription>
                     <Button onClick={handleRequestConnection} className="mt-4 button-modern" disabled={isRequesting}>
                        {isRequesting ? ( <Loader2 className="mr-2 h-4 w-4 animate-spin" /> ) : ( <Send className="mr-2 h-4 w-4" /> )}
                        Solicitar Novo QR Code
                    </Button>
                </Alert>
            );
          }
          return (
             <Card className="text-center border-primary/30 shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl font-bold text-gradient">Ação Necessária: Autorize a Conexão</CardTitle>
                    <CardDescription className="text-muted-foreground text-base pt-2">
                        Para sua segurança, você precisa autorizar esta conexão. Abra o WhatsApp no seu celular, vá para <strong>Configurações &gt; Aparelhos conectados</strong> e aponte a câmera para a imagem abaixo.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center p-6">
                    <div className="p-4 bg-white rounded-lg inline-block shadow-inner border">
                        <Image src={waStatus.qrDataUri && (waStatus.qrDataUri.startsWith('data:') || waStatus.qrDataUri.startsWith('http')) ? waStatus.qrDataUri : 'https://placehold.co/256x256.png'} alt="WhatsApp QR Code" width={256} height={256} className="rounded-md" />
                    </div>
                </CardContent>
             </Card>
          );
      }
      
      if (isRequesting) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-muted/30 rounded-lg min-h-[150px]">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="mt-4 text-muted-foreground">Enviando sinal para a ponte local. Aguarde...</p>
            </div>
        );
      }
      
      return (
        <Alert variant="destructive" className="flex flex-col items-center text-center p-6">
            <WifiOff className="h-8 w-8 mb-3" />
            <AlertTitle className="font-semibold text-lg mb-2">Ponte Desconectada</AlertTitle>
            <AlertPrimitiveDescription className="mb-4">
               A conexão com sua ponte local do WhatsApp não está ativa. Clique no botão abaixo para enviar um sinal e (re)iniciar a conexão.
            </AlertPrimitiveDescription>
             <Button onClick={handleRequestConnection} className="button-modern" disabled={isRequesting}>
                 <Send className="mr-2 h-4 w-4" />
                 Solicitar Conexão / Novo QR Code
            </Button>
        </Alert>
      );
  }

  return (
    <div className="flex justify-center items-start pt-10">
      <Card className="w-full max-w-2xl card-professional modern-shadow-xl">
        <CardHeader className="text-center p-8 border-b header-modern">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center mb-4 float">
                <QrCode className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-3xl font-heading font-bold text-gradient">
                Conexão com WhatsApp
            </CardTitle>
            <CardDescription className="text-lg text-muted-foreground mt-2">
                Gerencie a ponte de conexão para envio de notificações em tempo real.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-6 sm:p-8 space-y-6">
           <div className="flex items-center justify-center">
              <StatusIndicator status={waStatus?.status} lastConnectedAt={waStatus?.readyAt as Timestamp | undefined} />
           </div>

          <div className="pt-6 border-t border-border/50">
            <h3 className="text-center text-xl font-bold text-foreground mb-4">Status da Conexão</h3>
            {renderStatusContent()}
          </div>
          
          <div className="pt-6 border-t border-border/50">
            <h3 className="text-center text-xl font-bold text-foreground mb-4">Configuração Avançada</h3>
            <Card>
              <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold">Permissões de Upload (CORS)</h4>
                  <p className="text-sm text-muted-foreground">
                    Se os uploads de imagens (logos) estiverem falhando, clique aqui para configurar as permissões do Firebase Storage.
                  </p>
                </div>
                <Button onClick={handleSetupCors} disabled={isSettingCors} variant="outline" className="shrink-0">
                  {isSettingCors ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CloudCog className="mr-2 h-4 w-4" />
                  )}
                  {isSettingCors ? 'Configurando...' : 'Configurar CORS'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
