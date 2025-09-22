
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  ShoppingBag,
  Package2,
  Building2,
  FileBarChart,
  TrendingUp,
  MessageSquare,
} from 'lucide-react';

const navItems = [
  { href: '/compras', label: 'Lista de Compras', icon: ShoppingBag, exact: false, description: 'Gerencie suas listas de compras' },
  { href: '/insumos', label: 'Insumos', icon: Package2, description: 'Controle seus produtos e materiais' },
  { href: '/fornecedores', label: 'Fornecedores', icon: Building2, description: 'Gerencie seus parceiros comerciais' },
  { href: '/cotacao', label: 'Cotação', icon: FileBarChart, description: 'Compare preços e condições' },
  { href: '/analise-de-precos', label: 'Análise de Preços', icon: TrendingUp, description: 'Insights e relatórios' },
  { href: '/whatsapp-admin', label: 'Ponte WhatsApp', icon: MessageSquare, description: 'Conexão e status da ponte' },
  { href: '/whatsapp-chat', label: 'Conversas', icon: MessageSquare, description: 'Central de comunicação' },
];

export default function ClientSidebarNavigation() {
  const pathname = usePathname();

  return (
    <SidebarMenu className="p-2">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact 
          ? pathname === item.href 
          : pathname.startsWith(item.href);
        
        return (
          <SidebarMenuItem key={item.href}>
            <SidebarMenuButton
              asChild
              isActive={isActive}
              className="justify-start nav-item-modern h-12 px-3"
              tooltip={{ 
                children: (
                  <div className="text-center">
                    <div className="font-semibold">{item.label}</div>
                    <div className="text-xs text-muted-foreground mt-3">{item.description}</div>
                  </div>
                ), 
                side: "right", 
                align: "center" 
              }}
              data-active={isActive}
            >
              <Link href={item.href} className="flex items-center gap-3 w-full">
                <Icon className="h-6 w-6 rotate-hover shrink-0" aria-hidden="true" />
                <span className="group-data-[collapsible=icon]:hidden font-medium">
                  {item.label}
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        );
      })}
    </SidebarMenu>
  );
}
