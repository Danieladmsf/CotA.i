# Sistema de Notificações - CotA.I

Este documento descreve o sistema completo de notificações implementado no CotA.I, que mantém um histórico dinâmico de todas as ações e eventos do sistema.

## 🔔 Funcionalidades Principais

### 1. **Sino de Notificações**
- **Localização**: Header da aplicação (ao lado do botão de menu)
- **Indicador Visual**: Badge vermelho com contador de notificações não lidas
- **Comportamento**: Clique no sino abre dropdown com notificações recentes

### 2. **Dropdown de Notificações Recentes**
- **Exibe**: Últimas 5 notificações
- **Informações**: Título, mensagem, tempo relativo, status de leitura
- **Ação**: Clique na notificação marca como lida e navega para a página relevante
- **Botão**: "Ver histórico completo" para abrir modal de histórico

### 3. **Modal de Histórico Completo**
- **Funcionalidades**: 
  - Lista paginada de todas as notificações
  - Sistema de filtros dinâmicos
  - Busca por cotação, tipo, status e data
  - Scroll infinito para carregar mais
  - Marcar todas como lidas

### 4. **Filtros Dinâmicos**
- **Por Cotação**: Dropdown com todas as cotações do usuário
- **Por Tipo**: Filtra por tipo de notificação
- **Por Status**: Lidas/Não lidas/Todas
- **Botões**: Limpar filtros, Atualizar

## 📱 Tipos de Notificação

### 🟠 Aprovação de Marcas
- `brand_approval_pending`: Nova marca aguarda aprovação
- `brand_approval_approved`: Marca foi aprovada 
- `brand_approval_rejected`: Marca foi rejeitada

### 🔵 Cotações
- `quotation_started`: Cotação foi iniciada
- `quotation_closed`: Cotação foi encerrada
- `deadline_approaching`: Prazo se aproximando

### 🟣 Ofertas
- `offer_received`: Nova oferta recebida
- `offer_outbid`: Oferta foi superada

### 💬 Sistema
- `system_message`: Mensagens gerais do sistema

## 🎨 Design e UX

### **Indicadores Visuais**
- **Não lida**: Borda azul, fundo azul claro, ponto azul
- **Lida**: Fundo neutro, sem indicadores especiais
- **Ícones**: Cada tipo tem ícone e cor específicos
- **Tempo**: Formato relativo (ex: "2min atrás", "1h atrás")

### **Navegação Inteligente**
- Clique na notificação navega automaticamente para:
  - Aprovações → `/cotacao?tab=aprovacoes`
  - Cotações → `/cotacao?quotation={id}`
  - Ofertas → página específica da cotação

### **Responsivo**
- Design adaptado para desktop e mobile
- Scroll areas otimizadas
- Botões e texto apropriados para toque

## 🔧 Implementação Técnica

### **Arquivos Principais**
```
src/
├── hooks/
│   ├── useNotifications.ts          # Hook principal para gerenciar notificações
│   └── useNotificationWatcher.ts    # Monitora mudanças e cria notificações
├── components/shared/
│   ├── NotificationBell.tsx         # Sino de notificações
│   └── NotificationHistory.tsx      # Modal de histórico completo  
├── actions/
│   └── notificationService.ts       # Funções server-side para criar notificações
└── types/index.ts                   # Tipos TypeScript
```

### **Coleção Firestore**
```typescript
// Collection: 'notifications'
interface SystemNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  quotationId?: string;
  quotationName?: string;
  productName?: string;
  supplierName?: string;
  brandName?: string;
  isRead: boolean;
  priority: 'low' | 'medium' | 'high';
  createdAt: Timestamp;
  readAt?: Timestamp;
  actionUrl?: string;
  metadata?: Record<string, any>;
}
```

### **Regras de Security (Firestore)**
```javascript
// Permite que usuários leiam apenas suas próprias notificações
match /notifications/{notificationId} {
  allow read, write: if isOwner(resource.data.userId);
  allow create: if isOwner(request.resource.data.userId);
}
```

## 📊 Gestão e Performance

### **Paginação**
- Carrega 20 notificações por vez
- Scroll infinito com carregamento sob demanda
- Filtros aplicados dinamicamente

### **Cleanup Automático**
- Função `cleanupOldNotifications()` para limpar notificações antigas
- Configurável (padrão: 30 dias)
- Executar periodicamente via cron ou function

### **Real-time**
- Usa `onSnapshot` para atualizações em tempo real
- Contador de não lidas sempre atualizado
- Novas notificações aparecem instantaneamente

## 🚀 Como Usar

### **Para Desenvolvedores**

#### Criar Notificação Personalizada
```typescript
import { createNotification } from '@/actions/notificationService';

await createNotification({
  userId: 'user-id',
  type: 'system_message',
  title: 'Título da Notificação',
  message: 'Mensagem detalhada',
  priority: 'high',
  actionUrl: '/pagina-destino'
});
```

#### Usar Hook de Notificações
```typescript
import { useNotifications } from '@/hooks/useNotifications';

const MyComponent = () => {
  const { notifications, unreadCount, markAsRead } = useNotifications({
    quotationId: 'specific-quotation-id' // Filtro opcional
  });
  
  // Usar notifications, unreadCount, etc.
};
```

### **Para Usuários Finais**

1. **Visualizar**: Ícone de sino no header mostra contador de não lidas
2. **Navegar**: Clique no sino para ver notificações recentes
3. **Filtrar**: Use modal completo para filtrar e buscar
4. **Gerenciar**: Marque como lidas individualmente ou em lote

## 🔄 Fluxo de Notificações

### **Quando são Criadas**
1. **Automáticas**: Monitora mudanças em `pending_brand_requests`
2. **Programáticas**: Nas ações de cotação (iniciar, fechar)
3. **Manuais**: Via chamadas diretas ao `notificationService`

### **Ciclo de Vida**
1. **Criação** → Aparece como não lida
2. **Visualização** → Usuário vê no dropdown/modal
3. **Interação** → Clique marca como lida e navega
4. **Cleanup** → Removida após período configurado

## 📈 Melhorias Futuras

- [ ] Push notifications via service worker
- [ ] Configurações de preferência por usuário
- [ ] Digest de notificações por email
- [ ] Analytics de engajamento
- [ ] Templates customizáveis
- [ ] Integração com outros canais (SMS, WhatsApp)

---

## 📝 Notas de Implementação

### **Estados Importantes**
- O sistema funciona apenas para usuários autenticados
- Notificações são isoladas por `userId`
- Filtros são aplicados em tempo real
- Paginação é otimizada para performance

### **Monitoramento**
- Logs detalhados para debug (`console.log` com emojis)
- Error handling em todas as operações
- Fallbacks para dados faltantes

### **Testes**
- Teste criação de notificação via aprovação de marca
- Verifique filtros no modal de histórico  
- Confirme navegação automática
- Teste responsividade em mobile

O sistema está pronto para uso em produção! 🎉