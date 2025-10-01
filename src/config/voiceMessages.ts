/**
 * Configuração de mensagens do assistente de voz
 * Personalize aqui todas as falas que o assistente irá utilizar
 */

export const voiceMessages = {
  // Mensagens de boas-vindas
  welcome: {
    quotationPage: (supplierName: string, itemCount: number) =>
      `${supplierName}, logo abaixo já está disponível a lista de cotação com ${itemCount === 1 ? '1 item' : `${itemCount} itens`}. Clique na seta próximo do nome, que eu te ajudarei a preencher corretamente.`,

    supplierPortal: (supplierName: string, openQuotations: number) =>
      `Bem-vindo ao seu portal, ${supplierName}! ${openQuotations > 0 ? `Você tem ${openQuotations} ${openQuotations === 1 ? 'cotação aberta' : 'cotações abertas'}.` : 'No momento não há cotações abertas.'}`,

    portalWithTodayQuotation: (supplierName: string, dateStr: string) =>
      `Olá ${supplierName}! Você tem cotações abertas com entrega prevista para ${dateStr}.`,
  },

  // Mensagens de navegação entre abas
  tabs: {
    all: "",
    required: "Você está na aba de itens obrigatórios. Complete todos os campos para prosseguir.",
    optional: "Você está na aba de itens opcionais.",
    sent: "Você está visualizando os itens já enviados.",
  },

  // Mensagens de validação
  validation: {
    missingRequired: (count: number) =>
      `Atenção: ainda faltam ${count} ${count === 1 ? 'item obrigatório' : 'itens obrigatórios'} para enviar sua cotação.`,

    allComplete: "Todos os itens obrigatórios foram preenchidos. Você já pode enviar sua cotação.",

    invalidPrice: "O preço informado é inválido. Por favor, insira um valor válido.",

    invalidQuantity: "A quantidade informada é inválida.",
  },

  // Mensagens de sucesso
  success: {
    offerSaved: "Oferta salva com sucesso.",
    quotationSent: "Cotação enviada com sucesso! Obrigado pela participação.",
    brandAdded: "Nova marca adicionada com sucesso.",
  },

  // Mensagens de erro
  error: {
    saveFailed: "Erro ao salvar a oferta. Tente novamente.",
    loadFailed: "Erro ao carregar os dados da cotação.",
    deadlinePassed: "Atenção: o prazo desta cotação já expirou.",
  },

  // Mensagens de ações
  actions: {
    offerUpdated: (productName: string) =>
      `Oferta atualizada para ${productName}.`,

    offerRemoved: (productName: string) =>
      `Oferta removida de ${productName}.`,

    brandApproved: (brandName: string) =>
      `Sua sugestão da marca ${brandName} foi aceita e agora faz parte desta cotação.`,

    brandRejected: (brandName: string) =>
      `Sua sugestão da marca ${brandName} foi recusada pelo comprador.`,


    addingNewBrand: "Abrindo formulário para adicionar nova marca.",

    openingNewBrandModal: "Ok, vamos solicitar uma nova marca. Sua sugestão será enviada para o comprador analisar. Preencha os dados do produto e, assim que você enviar, eu avisarei o comprador imediatamente e retornarei com a resposta de aprovação.",

    itemExpanded: (productName: string, hasDeliveryMismatch: boolean) =>
      `Ok, ${productName}! Vamos lá! ${hasDeliveryMismatch ? 'Atenção: o comprador determinou um dia de entrega que não faz parte da sua grade de entrega. Verifique se consegue entregar na data solicitada. ' : ''}Escolha uma marca inicial em Marcas Sugeridas ou clique em Outra Marca para enviar ao comprador aprovar. Como quer começar?`,

    itemExpandedWithOffer: (productName: string, hasMultipleOffers: boolean, isWinning: boolean, competitorPrice?: string) => {
      if (isWinning) {
        return `Ótimo! Você já enviou oferta para ${productName} e está com o melhor preço! ${hasMultipleOffers ? 'Você pode adicionar outra marca clicando em uma das marcas sugeridas ou em Outra Marca.' : ''} Use o botão Editar para alterar sua oferta, ou Parar de Cotar este Item para removê-la. Se desejar, pode iniciar uma nova oferta em outro item. Caso sua oferta seja superada, enviarei uma mensagem no seu whatsapp, fique tranquilo!`;
      } else if (competitorPrice) {
        return `Atenção! Você já enviou oferta para ${productName}, mas outro fornecedor está oferecendo por ${competitorPrice}, um preço menor que o seu. ${hasMultipleOffers ? 'Você pode adicionar outra marca ou' : 'Você pode'} editar sua oferta clicando no botão Editar, usar os botões de Cobrir Oferta para superar automaticamente em 1%, 2%, 3%, 4% ou 5%, ou clicar em Parar de Cotar este Item para remover sua oferta.`;
      } else {
        return `Você já enviou oferta para ${productName}. ${hasMultipleOffers ? 'Quer adicionar outra marca? Clique em uma das marcas sugeridas ou em Outra Marca.' : 'Pode iniciar uma nova oferta em outro item.'} Use o botão Editar para alterar sua oferta, ou Parar de Cotar este Item para removê-la. Caso sua oferta seja superada, enviarei uma mensagem no seu whatsapp, fique tranquilo!`;
      }
    },

    brandSelected: (brandName: string, unit: string) =>
      `Ok, ${brandName}! Agora você precisa preencher apenas 4 informações. A primeira, Sua Marca Ofertada, já foi preenchida com ${brandName}. A próxima etapa é colocar como o seu item vem embalado: 1 caixa, 1 palete com 10 caixas e 13 garrafas, ou 1 fardo com 5 pacotes de 2 ${unit}?`,
  },

  // Mensagens de status
  status: {
    loading: "Carregando dados da cotação.",
    saving: "Salvando sua oferta.",
    deadline: (timeLeft: string) =>
      `Tempo restante para enviar ofertas: ${timeLeft}.`,
  },

  // Mensagens de alertas competitivos
  competition: {
    outbid: (productName: string) =>
      `Atenção: você foi superado no item ${productName}. Considere atualizar sua oferta.`,

    bestPrice: (productName: string) =>
      `Parabéns! Você tem o melhor preço para ${productName}.`,
  },

  // Mensagens de ajuda
  help: {
    navigation: "Use as abas no topo para navegar entre itens obrigatórios, opcionais e enviados.",
    fillForm: "Preencha marca, embalagem, unidades por embalagem e preço total da embalagem para cada item.",
    deadline: "Fique atento ao prazo limite para envio das ofertas.",
  },

  // Mensagens de campos do formulário
  formFields: {
    packagingDescriptionFilled: "Ok, preenchido Descrição da Embalagem. Vamos para a próxima etapa.",

    unitsInPackagingPrompt: (unit: string, category: string) => {
      const isWeightOrVolume = unit.toLowerCase() === 'kg' || unit.toLowerCase() === 'litro' || unit.toLowerCase() === 'l';
      if (isWeightOrVolume && (category.toLowerCase().includes('carne') || category.toLowerCase().includes('frios'))) {
        return `Total de unidades na embalagem. Como você está cotando categoria carnes, o correto é sempre colocar 1, que se refere a 1 quilo de carne.`;
      }
      return `Total de unidades na embalagem. Aqui você irá colocar o litro, peso ou quantidade de unidades na embalagem.`;
    },

    unitsInPackagingFilled: "Ok, vamos para Preço Total da Embalagem.",

    pricePrompt: (unit: string) =>
      `Preço Total da Embalagem. Aqui você irá colocar o preço do ${unit}.`,

    priceFilled: (productName: string, brandName: string, price: string, unit: string) =>
      `Perfeito! O ${productName} ${brandName} custa ${price} por ${unit}. Agora clique no botão Enviar Oferta. Caso você queira adicionar mais ofertas do mesmo item, repita o processo. Se tiver dúvida, clique no ponto de interrogação de cada etapa que irei te ajudar.`,

    // Ajuda dos campos (ao clicar no ícone ?)
    brandHelp: "Marca Ofertada: Digite ou selecione a marca do produto que você está oferecendo. Se a marca não estiver na lista, clique em Outra Marca para solicitar aprovação.",

    packagingHelp: "Descrição da Embalagem: Descreva como seu produto vem embalado. Por exemplo: 1 caixa com 10 unidades, 1 fardo com 5 pacotes de 2 quilos, ou 1 garrafa de 500 mililitros.",

    unitsHelp: (unit: string) =>
      `Total de Unidades na Embalagem: Informe quantos ${unit} vêm na embalagem que você descreveu. Por exemplo, se é 1 caixa com 12 quilos, coloque 12.`,

    priceHelp: (unit: string) =>
      `Preço Total da Embalagem: Digite o preço total da embalagem completa que você descreveu. O sistema calculará automaticamente o preço por ${unit}.`,
  },
};

export type VoiceMessageConfig = typeof voiceMessages;
