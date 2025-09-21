'use client';

import { Inter, Poppins, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';

import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarInset,
  SidebarFooter
} from '@/components/ui/sidebar';
import ClientSidebarNavigation from '@/components/shared/ClientSidebarNavigation';
import { Zap, Loader2, LogOut } from 'lucide-react';
import { CurrentYear } from '@/components/shared/CurrentYear';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const poppins = Poppins({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-poppins', display: 'swap' });
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap' });

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();

  console.log('🔍 ProtectedLayout - State:', { user: !!user, loading, userEmail: user?.email });

  // TEMPORÁRIO: Desabilitar autenticação para teste
  const BYPASS_AUTH = false;

  useEffect(() => {
    console.log('🔄 ProtectedLayout - useEffect triggered:', { loading, user: !!user });
    if (!BYPASS_AUTH && !loading && !user) {
      console.log('🚀 Redirecting to /login');
      router.push('/login');
    }
  }, [user, loading, router]);

  if (!BYPASS_AUTH && (loading || !user)) {
    console.log('⏳ Showing loading screen or no user');
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
              <h1 className="text-xl font-bold">EasyTrade</h1>
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
      <SidebarInset>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}

function RootLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  console.log('🌍 RootLayoutContent - Pathname:', pathname, 'isLoginPage:', isLoginPage);

  return (
    <html lang="pt-BR" className={`${inter.variable} ${poppins.variable} ${jetbrainsMono.variable}`}>
      <head>
        <title>EasyTrade</title>
        <meta name="description" content="Gerenciamento de compras e cotações." />
        <link rel="icon" href="/favicon.ico" />
      </head>
      <body className="font-sans antialiased bg-background text-foreground">
        {isLoginPage ? (
          <>{children}</>
        ) : (
          <ProtectedLayout>{children}</ProtectedLayout>
        )}
        <Toaster />
      </body>
    </html>
  );
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <AuthProvider>
      <CategoriesProvider>
        <RootLayoutContent>{children}</RootLayoutContent>
      </CategoriesProvider>
    </AuthProvider>
  );
}