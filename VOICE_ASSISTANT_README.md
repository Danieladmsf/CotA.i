# Assistente de Voz - Portal do Fornecedor

## 📢 Sobre

O assistente de voz foi implementado para proporcionar uma experiência mais acessível e interativa ao portal do fornecedor. Ele narra automaticamente ações e eventos importantes durante a navegação.

## 🎯 Funcionalidades Implementadas

### 1. **Controle de Ativação**
- Botão de toggle no header (ícone de volume)
- Preferência salva no localStorage
- Suporte apenas para navegadores compatíveis com Web Speech API

### 2. **Narrações Automáticas**

#### Ao Carregar a Cotação
- Mensagem de boas-vindas com número da cotação
- Instruções básicas sobre o que fazer

#### Navegação entre Abas
- **Todos os itens**: "Você está visualizando todos os itens da cotação."
- **Itens Obrigatórios**: "Você está na aba de itens obrigatórios. Complete todos os campos para prosseguir."
- **Itens Opcionais**: "Você está na aba de itens opcionais."
- **Itens Enviados**: "Você está visualizando os itens já enviados."

#### Ao Salvar Ofertas
- **Sucesso**: "Oferta salva com sucesso."
- **Erro**: "Erro ao salvar a oferta. Tente novamente."

#### Ao Carregar Dados
- **Erro**: "Erro ao carregar os dados da cotação."

## 🎨 Como Personalizar as Mensagens

Todas as mensagens são configuráveis através do arquivo:
```
src/config/voiceMessages.ts
```

### Exemplo de Personalização

```typescript
export const voiceMessages = {
  // Mensagens de boas-vindas
  welcome: {
    quotationPage: (quotationId: string) =>
      `Olá! Você está na cotação ${quotationId}. Vamos começar?`,
  },

  // Mensagens de navegação
  tabs: {
    required: "Atenção! Estes são os itens obrigatórios da cotação.",
  },

  // Mensagens de sucesso
  success: {
    offerSaved: "Ótimo! Sua oferta foi salva com sucesso.",
  },

  // E assim por diante...
};
```

### Tipos de Mensagens Disponíveis

1. **`welcome`** - Mensagens de boas-vindas
   - `quotationPage(quotationId)` - Ao entrar na cotação
   - `supplierPortal(supplierName)` - Ao entrar no portal

2. **`tabs`** - Navegação entre abas
   - `all` - Todos os itens
   - `required` - Itens obrigatórios
   - `optional` - Itens opcionais
   - `sent` - Itens enviados

3. **`validation`** - Validações
   - `missingRequired(count)` - Itens faltantes
   - `allComplete` - Tudo completo
   - `invalidPrice` - Preço inválido
   - `invalidQuantity` - Quantidade inválida

4. **`success`** - Ações bem-sucedidas
   - `offerSaved` - Oferta salva
   - `quotationSent` - Cotação enviada
   - `brandAdded` - Marca adicionada

5. **`error`** - Erros
   - `saveFailed` - Falha ao salvar
   - `loadFailed` - Falha ao carregar
   - `deadlinePassed` - Prazo expirado

6. **`actions`** - Ações do usuário
   - `offerUpdated(productName)` - Oferta atualizada
   - `offerRemoved(productName)` - Oferta removida
   - `addingNewBrand` - Adicionando nova marca

7. **`status`** - Status do sistema
   - `loading` - Carregando
   - `saving` - Salvando
   - `deadline(timeLeft)` - Tempo restante

8. **`competition`** - Alertas competitivos
   - `outbid(productName)` - Foi superado
   - `bestPrice(productName)` - Melhor preço

9. **`help`** - Mensagens de ajuda
   - `navigation` - Como navegar
   - `fillForm` - Como preencher
   - `deadline` - Sobre o prazo

## 🎛️ Opções de Customização Avançada

O hook `useVoiceAssistant` suporta opções adicionais:

```typescript
speak("Mensagem personalizada", {
  rate: 1.2,    // Velocidade (0.1 a 10, padrão 1)
  pitch: 1,     // Tom (0 a 2, padrão 1)
  volume: 0.8   // Volume (0 a 1, padrão 1)
});
```

### Exemplo no Código

```typescript
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant';
import { voiceMessages } from '@/config/voiceMessages';

function MeuComponente() {
  const { speak } = useVoiceAssistant();

  const handleClick = () => {
    speak(voiceMessages.success.offerSaved);
    // Ou com personalização:
    speak("Mensagem urgente!", { rate: 1.5, pitch: 1.2 });
  };

  return <button onClick={handleClick}>Salvar</button>;
}
```

## 🌐 Compatibilidade

- ✅ Chrome / Edge (Chromium)
- ✅ Safari
- ✅ Firefox
- ⚠️ Vozes variam por navegador e sistema operacional
- ⚠️ Algumas vozes em pt-BR podem não estar disponíveis em todos os sistemas

## 🔧 Arquivos Importantes

```
src/
├── hooks/
│   └── useVoiceAssistant.ts          # Hook principal
├── config/
│   └── voiceMessages.ts              # Configurações de mensagens
├── components/
│   └── shared/
│       └── Header.tsx                # Botão de toggle
└── app/(portal)/portal/[supplierId]/
    └── cotar/[quotationId]/
        └── page.tsx                  # Página com narrações
```

## 🚀 Adicionando Novas Narrações

1. **Adicione a mensagem em `voiceMessages.ts`**:
```typescript
export const voiceMessages = {
  // ... mensagens existentes
  myNewSection: {
    myNewMessage: "Nova mensagem aqui",
    dynamicMessage: (param: string) => `Olá, ${param}!`,
  },
};
```

2. **Use no componente**:
```typescript
const { speak } = useVoiceAssistant();

// Mensagem estática
speak(voiceMessages.myNewSection.myNewMessage);

// Mensagem dinâmica
speak(voiceMessages.myNewSection.dynamicMessage("João"));
```

## 💡 Dicas

- Use mensagens curtas e objetivas (máx. 2-3 frases)
- Evite informações técnicas complexas
- Foque no "por quê" e não no "como"
- Teste com diferentes velocidades para achar o tom ideal
- Considere o contexto do usuário (urgência, importância)

## 🐛 Troubleshooting

**Assistente não aparece?**
- Verifique se o navegador suporta Web Speech API
- Abra o console e procure por erros

**Voz não está em português?**
- A voz padrão depende do sistema operacional
- Instale pacotes de idioma pt-BR no seu sistema

**Mensagem não está tocando?**
- Verifique se o assistente está ativado (ícone de volume no header)
- Verifique as permissões de som do navegador
- Certifique-se de que o volume do sistema não está no mudo

---

Desenvolvido para melhorar a experiência e acessibilidade do Portal do Fornecedor 🎙️
