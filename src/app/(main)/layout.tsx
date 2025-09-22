'use client';

import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarTrigger, SidebarContent, SidebarInset, SidebarFooter } from '@/components/ui/sidebar';
import ClientSidebarNavigation from '@/components/shared/ClientSidebarNavigation';
import { Zap, Loader2, LogOut } from 'lucide-react';
import { CurrentYear } from '@/components/shared/CurrentYear';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  const BYPASS_AUTH = false; // Should be false in production

  useEffect(() => {
    if (!BYPASS_AUTH && !loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (!BYPASS_AUTH && (loading || !user)) {
    return (
      <div className="flex w-full h-screen items-center justify-center">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
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
          <SidebarTrigger className="group-data-[collapsible=icon]:hidden" />
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
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function MainAppLayout({ children }: { children: React.ReactNode }) {
    return <ProtectedLayout>{children}</ProtectedLayout>
}