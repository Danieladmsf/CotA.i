/**
 * Configuração de mensagens do assistente de voz
 * Personalize aqui todas as falas que o assistente irá utilizar
 */

export const voiceMessages = {
  // Mensagens de boas-vindas
  welcome: {
    quotationPage: (quotationId: string) =>
      `Bem-vindo à cotação número ${quotationId}. Preencha os campos de marca, modelo e preço para cada item.`,

    supplierPortal: (supplierName: string) =>
      `Olá, ${supplierName}. Bem-vindo ao portal do fornecedor.`,
  },

  // Mensagens de navegação entre abas
  tabs: {
    all: "Você está visualizando todos os itens da cotação.",
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

    addingNewBrand: "Abrindo formulário para adicionar nova marca.",
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
};

export type VoiceMessageConfig = typeof voiceMessages;
