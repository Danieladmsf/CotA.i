# 📋 ROTEIRO COMPLETO: Portal do Fornecedor
## Análise de Funcionalidades e Oportunidades de Narração por Voz

---

## 🎯 PÁGINA INICIAL DO PORTAL (`/portal/[supplierId]`)

### ✅ Funcionalidades Existentes:
1. **Header com nome e foto do fornecedor**
2. **Botão "Editar Dados"** - Abre modal para atualizar informações
3. **Lista de cotações** ordenadas por prazo
4. **Cards de cotação** com:
   - Status visual (Aberta=verde, Fechada=laranja, Pausada=amarelo)
   - Data de entrega
   - Prazo final
   - Ref ID
   - Botões de ação ("Visualizar e Cotar" ou "Ver Resultado")

### ✅ Narrações JÁ Implementadas:
- ✅ Boas-vindas com nome do fornecedor
- ✅ Informa quantidade de cotações abertas
- ✅ Menciona data de entrega prevista

### 🎙️ OPORTUNIDADES DE NARRAÇÃO:

#### 1. **Ao clicar em "Editar Dados"**
```
"Abrindo formulário de edição. Você pode atualizar seu nome, CNPJ, contato,
endereço e dias de entrega. Lembre-se de salvar as alterações ao finalizar."
```

#### 2. **Ao passar mouse sobre cotação fechada**
```
"Esta cotação está fechada. Prazo encerrado em [data].
Clique em Ver Resultado para conferir o resultado final."
```

#### 3. **Ao passar mouse sobre cotação pausada**
```
"Esta cotação está pausada temporariamente pelo comprador."
```

#### 4. **Quando não há cotações abertas**
```
"Você não tem cotações abertas no momento. Fique atento ao seu WhatsApp
para ser notificado quando surgirem novas oportunidades."
```

---

## 🎯 PÁGINA DA COTAÇÃO (`/portal/[supplierId]/cotar/[quotationId]`)

### ✅ Funcionalidades Existentes:

#### **1. HEADER DA COTAÇÃO**
- Botão "Voltar ao Portal"
- **Contador regressivo** (tempo até prazo final)
- **Card de dados do fornecedor** (nome, CNPJ, foto)
- **Detalhes da cotação** (status, data da lista, data de criação)

#### **2. SISTEMA DE ABAS**
- **"Todos"** - Todos os produtos
- **"Geral"** - Categoria específica
- **Outras categorias dinâmicas**

#### **3. CARDS DE PRODUTOS**
- **Informações do produto:**
  - Nome
  - Quantidade pedida
  - Unidade de medida
  - Data de entrega específica
  - Observações do comprador
  - Marcas sugeridas (badges clicáveis)
  - Botão "Outra Marca"

- **Sistema de ofertas:**
  - Formulário com 4 campos:
    - Marca Ofertada (com ícone ?)
    - Descrição da Embalagem (com ícone ?)
    - Total Un na Emb. (com ícone ?)
    - Preço Total da Emb. (com ícone ?)
  - Cálculo automático de preço por unidade
  - Botão "Enviar Oferta"
  - Botão "Editar" (ofertas salvas)
  - Botão "Parar de Cotar" / "Remover"
  - **Botões "Cobrir Oferta"** (1%, 2%, 3%, 4%, 5%)

#### **4. SISTEMA DE ALERTAS**
- **Alerta de incompatibilidade de entrega** (dia fora da grade)
- **Alerta de contraproposta** (quando superado)
- **Alerta de lockout** (prazo de contraproposta expirado)
- **Badges de melhor preço** (sua oferta vs concorrentes)
- **Animações visuais** (borda pulsante verde=ganhando, vermelha=perdendo)

#### **5. MODAL DE NOVA MARCA**
- Campo para nome da marca
- Descrição da embalagem
- Unidades na embalagem
- Preço total
- Upload de imagem da marca
- Sistema de aprovação pendente

#### **6. SISTEMA DE NOTIFICAÇÕES**
- Sino de notificações no header
- Alertas quando superado
- Lembretes de contraproposta

---

## ✅ Narrações JÁ Implementadas:

### **Entrada na Página:**
- ✅ Boas-vindas com nome + data + quantidade de itens

### **Ao Expandir Item:**
- ✅ **SEM oferta**: Orienta sobre marcas
- ✅ **COM oferta - Ganhando**: Parabeniza e orienta sobre próximos passos
- ✅ **COM oferta - Perdendo**: Alerta sobre concorrente e orienta como superar
- ✅ **Múltiplas ofertas**: Adaptação da mensagem

### **Ao Selecionar Marca:**
- ✅ Confirma marca e explica 4 campos

### **Campos do Formulário:**
- ✅ **onFocus**: Explica o que preencher
- ✅ **onBlur**: Confirma preenchimento e avança
- ✅ **Ícones ?**: Ajuda contextual ao clicar

### **Ao Salvar:**
- ✅ Sucesso ou erro

### **Navegação entre Abas:**
- ✅ Narra nome da aba

---

## 🎙️ OPORTUNIDADES DE NARRAÇÃO ADICIONAIS:

### **1. CONTADOR REGRESSIVO**

#### Quando faltam 10 minutos:
```
"Atenção! Faltam apenas 10 minutos para o prazo final desta cotação.
Revise suas ofertas e envie o que falta."
```

#### Quando faltam 1 minuto:
```
"Último minuto! Prazo encerrando em instantes!"
```

#### Quando expira:
```
"Prazo encerrado. Esta cotação foi fechada. Você pode ver o resultado
voltando ao portal."
```

---

### **2. BOTÃO "VOLTAR AO PORTAL"**

#### Ao clicar:
```
"Voltando ao portal principal. Suas ofertas foram salvas."
```

#### Se houver itens obrigatórios não cotados:
```
"Atenção! Você tem [X] itens obrigatórios sem oferta.
Tem certeza que deseja sair?"
```

---

### **3. SISTEMA DE INCOMPATIBILIDADE DE ENTREGA**

#### Ao expandir item com alerta laranja:
```
"Atenção! A data de entrega solicitada é [dia], mas sua grade de entregas
é [lista de dias]. Você pode cotar confirmando que consegue entregar
fora da sua grade habitual."
```

#### Ao clicar "Cotar mesmo assim":
```
"Ok, confirmado que você pode entregar nesta data. Prossiga com sua oferta."
```

---

### **4. BOTÃO "OUTRA MARCA"**

#### Ao clicar:
```
"Abrindo formulário para solicitar aprovação de nova marca.
Preencha o nome da marca, descrição da embalagem, unidades,
preço e envie uma foto se possível. O comprador receberá
sua solicitação para aprovação."
```

#### Após enviar solicitação:
```
"Solicitação enviada! O comprador foi notificado e você receberá
uma resposta em breve. Enquanto isso, você pode cotar outros itens."
```

#### Quando marca pendente é aprovada:
```
"Boa notícia! Sua marca [Nome] foi aprovada para o item [Produto].
Você já pode enviar sua oferta."
```

#### Quando marca pendente é rejeitada:
```
"Sua marca [Nome] não foi aprovada para o item [Produto].
Motivo: [texto]. Tente outra marca ou entre em contato com o comprador."
```

---

### **5. BOTÕES "COBRIR OFERTA"**

#### Ao clicar em "Cobrir 1%":
```
"Sua oferta foi ajustada para [valor], 1% abaixo do concorrente.
Clique em Enviar Oferta para confirmar."
```

#### Ao clicar em "Cobrir 5%":
```
"Sua oferta foi ajustada para [valor], 5% abaixo do concorrente.
Este é um desconto agressivo. Clique em Enviar Oferta para confirmar."
```

---

### **6. BOTÃO "EDITAR" (Ofertas Salvas)**

#### Ao clicar:
```
"Modo de edição ativado. Altere os campos que desejar e
clique em Enviar Oferta para salvar as mudanças."
```

#### Ao salvar edição:
```
"Oferta atualizada com sucesso! Seu novo preço é [valor] por [unidade]."
```

---

### **7. BOTÃO "PARAR DE COTAR" / "REMOVER"**

#### Ao clicar:
```
"Tem certeza que deseja remover esta oferta de [Produto] - [Marca]?
Esta ação não pode ser desfeita."
```

#### Após confirmar remoção:
```
"Oferta removida. Você pode adicionar uma nova oferta a qualquer momento
antes do prazo final."
```

---

### **8. ALERTAS DE CONTRAPROPOSTA**

#### Quando acionado o alerta laranja:
```
"Você foi superado no item [Produto]! Outro fornecedor ofereceu
um preço menor. Você tem [X] minutos para fazer uma contraproposta.
Clique no item para revisar e melhorar sua oferta."
```

#### Quando prazo de contraproposta está acabando:
```
"Últimos [X] minutos para fazer contraproposta no item [Produto]!
Aproveite esta chance antes que o prazo expire."
```

#### Quando perde o prazo de contraproposta:
```
"Prazo de contraproposta expirado para [Produto].
Você não pode mais alterar esta oferta."
```

---

### **9. NOTIFICAÇÕES (Sino)**

#### Ao clicar no sino:
```
"Você tem [X] notificações. [Resumo rápido das mais importantes]"
```

#### Quando recebe nova notificação:
```
"Nova notificação! [Resumo curto]"
```

---

### **10. SISTEMA DE PREÇOS OCULTOS**

#### Quando não tem oferta e tenta ver preços:
```
"Os preços dos concorrentes estão ocultos. Envie sua primeira oferta
para ter acesso aos preços dos outros fornecedores."
```

---

### **11. BADGES DE MELHOR PREÇO**

#### Ao passar mouse sobre badge "Melhor Preço":
```
"Parabéns! Você tem o melhor preço para esta marca."
```

#### Ao passar mouse sobre badge com preço do concorrente:
```
"O fornecedor [Nome] está oferecendo esta marca por [Preço].
Seu preço atual é [Seu Preço]."
```

---

### **12. VALIDAÇÕES E ERROS**

#### Tentativa de enviar oferta incompleta:
```
"Preencha todos os campos obrigatórios: Marca, Descrição da Embalagem,
Total de Unidades e Preço."
```

#### Tentativa de enviar preço inválido:
```
"O preço informado é inválido. Digite um valor maior que zero."
```

#### Tentativa de enviar oferta duplicada:
```
"Você já enviou esta oferta. Clique em Editar se desejar alterá-la."
```

#### Tentativa de cobrir oferta com preço insuficiente:
```
"Atenção! Para cobrir a oferta do concorrente, seu preço deve ser
pelo menos 1% menor. O valor mínimo é [Valor]."
```

---

### **13. CATEGORIAS E FILTROS**

#### Ao clicar em aba de categoria:
```
"Você está visualizando apenas os itens da categoria [Nome].
[X] itens nesta categoria."
```

#### Quando categoria está vazia:
```
"Não há itens nesta categoria."
```

---

### **14. RESUMO FINAL**

#### Quando completar todos obrigatórios:
```
"Parabéns! Você cotou todos os itens obrigatórios.
Suas ofertas foram enviadas. Agora é aguardar o resultado.
Você será notificado no WhatsApp sobre qualquer atualização."
```

#### Ao sair com itens faltando:
```
"Você ainda tem [X] itens obrigatórios sem oferta.
Volte antes do prazo para completar sua cotação."
```

---

## 📊 RESUMO DE IMPLEMENTAÇÃO

### ✅ **JÁ IMPLEMENTADO (15 pontos de narração)**
1. Boas-vindas portal
2. Boas-vindas cotação
3. Expandir item sem oferta
4. Expandir item com oferta (ganhando)
5. Expandir item com oferta (perdendo)
6. Seleção de marca
7. Campo: Marca (ajuda)
8. Campo: Embalagem (foco + blur + ajuda)
9. Campo: Unidades (foco + blur + ajuda)
10. Campo: Preço (foco + blur + ajuda)
11. Salvar oferta (sucesso)
12. Salvar oferta (erro)
13. Navegação entre abas
14. Detecção de incompatibilidade de entrega
15. Múltiplas ofertas (adaptação)

### 🎙️ **OPORTUNIDADES ADICIONAIS (25+ pontos)**
1. Contador regressivo (10min, 1min, expirou)
2. Voltar ao portal (com/sem alertas)
3. Incompatibilidade de entrega (detalhada)
4. Outra marca (abrir + enviar + aprovação/rejeição)
5. Botões cobrir oferta (1-5%)
6. Editar oferta (ativar + salvar)
7. Remover oferta (confirmar + confirmado)
8. Alertas de contraproposta (acionado + expirando + expirado)
9. Notificações (abrir + nova)
10. Preços ocultos
11. Badges de preço (melhor/concorrente)
12. Validações (campos vazios, preço inválido, duplicado, insuficiente)
13. Categorias (trocar + vazia)
14. Resumo final (completo + incompleto)
15. Editar dados do fornecedor
16. Status de cotações (fechada, pausada)
17. Nenhuma cotação aberta

---

## 🎯 PRIORIZAÇÃO SUGERIDA

### **🔴 ALTA PRIORIDADE**
1. Contador regressivo (urgência)
2. Alertas de contraproposta (competição)
3. Botões cobrir oferta (ação rápida)
4. Validações de campos (prevenção de erros)
5. Voltar ao portal com alertas (completude)

### **🟡 MÉDIA PRIORIDADE**
6. Outra marca (workflow completo)
7. Editar/Remover ofertas (gerenciamento)
8. Notificações (awareness)
9. Resumo final (satisfação)

### **🟢 BAIXA PRIORIDADE**
10. Badges e tooltips (informativo)
11. Categorias (navegação)
12. Status de cotações (informativo)

---

## 💡 RECOMENDAÇÕES FINAIS

1. **Personalização**: Permitir ajustar velocidade e tom da voz
2. **Modo Tutorial**: Primeira vez do usuário = narrações mais detalhadas
3. **Atalhos de Teclado**: Integrar com narrações (ex: "Pressione Tab para próximo campo")
4. **Confirmações Importantes**: Sempre pedir confirmação antes de ações críticas
5. **Feedback Positivo**: Reforçar comportamentos corretos com mensagens motivacionais

---

**Desenvolvido para tornar o Portal do Fornecedor 100% acessível e intuitivo! 🎙️**
