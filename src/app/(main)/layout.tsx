'use client';

import { useAuth } from '@/contexts/AuthContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { HeaderActionsProvider } from '@/contexts/HeaderActionsContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarTrigger, SidebarContent, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import ClientSidebarNavigation from '@/components/shared/ClientSidebarNavigation';
import NotificationSystem from '@/components/shared/NotificationSystem';
import { useNotificationWatcher } from '@/hooks/useNotificationWatcher';
import { Zap, Loader2, LogOut } from 'lucide-react';
import { CurrentYear } from '@/components/shared/CurrentYear';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Header from '@/components/shared/Header';



function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Initialize notification watcher
  useNotificationWatcher();

  // Add global navigation error handler
  useEffect(() => {
    const handleRouteChange = () => {
    };

    const handleError = (event: ErrorEvent) => {
      console.error('❌ [WINDOW] Error detected:', event.message, event.error);
    };

    window.addEventListener('popstate', handleRouteChange);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      window.removeEventListener('error', handleError);
    };
  }, []);

  // Page information mapping
  const pageInfo: Record<string, { title: string; description: string }> = {
    '/compras': { title: 'Compras', description: 'Gerencie suas solicitações de compra' },
    '/cotacao': { title: 'Cotações', description: 'Acompanhe suas cotações em andamento' },
    '/insumos': { title: 'Insumos', description: 'Cadastro e gestão de produtos' },
    '/fornecedores': { title: 'Fornecedores', description: 'Gerencie sua rede de fornecedores' },
    '/historico': { title: 'Histórico', description: 'Histórico de cotações e compras' },
    '/analise-de-precos': { title: 'Análise de Preços', description: 'Análise comparativa de preços' },
    '/whatsapp-admin': { title: 'WhatsApp Admin', description: 'Administração do WhatsApp Bridge' },
    '/whatsapp-chat': { title: 'WhatsApp Chat', description: 'Interface de chat do WhatsApp' },
  };

  const currentInfo = pageInfo[pathname] || { title: 'Dashboard', description: 'Visão geral do sistema' };

  const BYPASS_AUTH = false; // Should be false in production

  useEffect(() => {
    if (!BYPASS_AUTH && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router, pathname]);

  if (!BYPASS_AUTH && (loading || !user)) {
    return (
      <div className="flex w-full h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <CategoriesProvider>
      <HeaderActionsProvider>
        <SidebarProvider defaultOpen={true}>
          <Sidebar collapsible="icon" variant="sidebar" side="left">
          <SidebarHeader className="flex items-center justify-between p-4 group-data-[collapsible=icon]:justify-center">
            <div className="flex items-center gap-3 group-data-[collapsible=icon]:hidden">
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary to-accent">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold">CotA.I</h1>
                <p className="text-xs text-muted-foreground">Gestão Inteligente</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SidebarTrigger />
            </div>
          </SidebarHeader>
          <SidebarContent>
            <ClientSidebarNavigation />
          </SidebarContent>
          <SidebarFooter className="p-4 group-data-[collapsible=icon]:hidden">
            <Separator className="my-2" />
            <div className="flex items-center gap-3 py-2">
              <Avatar className="h-9 w-9">
                {user?.photoURL && <AvatarImage src={user.photoURL} alt={user.displayName || 'Avatar'} />}
                <AvatarFallback>{user?.displayName?.charAt(0).toUpperCase() || 'U'}</AvatarFallback>
              </Avatar>
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-semibold truncate">{user?.displayName || 'Demo User'}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email || 'demo@teste.com'}</p>
              </div>
            </div>
            <Button variant="outline" className="w-full justify-start mt-2" onClick={logout}>
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
            <p className="text-xs text-muted-foreground mt-4 text-center">&copy; <CurrentYear /> EasyTrade</p>
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="p-4">
          <Header title={currentInfo.title} description={currentInfo.description} />
          <main className="mt-6">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
      </HeaderActionsProvider>
    </CategoriesProvider>
  );
}

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedLayout>{children}</ProtectedLayout>
}