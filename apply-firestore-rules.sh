#!/bin/bash

# Script para aplicar regras do Firestore
echo "🔥 Aplicando regras do Firestore..."

# Verificar se o Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI não encontrado. Instalando..."
    npm install -g firebase-tools
fi

# Fazer backup das regras atuais (opcional)
echo "📋 Fazendo backup das regras atuais..."
firebase firestore:rules get > firestore-rules-backup.txt 2>/dev/null || echo "⚠️ Não foi possível fazer backup (normal se for primeira vez)"

# Copiar as regras atualizadas
echo "📝 Usando regras atualizadas..."
cp firestore-rules-updated.rules firestore.rules

# Aplicar as regras
echo "🚀 Aplicando regras do firestore.rules..."
firebase deploy --only firestore:rules

if [ $? -eq 0 ]; then
    echo "✅ Regras aplicadas com sucesso!"
    echo ""
    echo "📝 Regras aplicadas incluem:"
    echo "   ✓ Coleção 'notifications' com acesso completo"
    echo "   ✓ Coleção 'incoming_messages' para WhatsApp"
    echo "   ✓ Coleção 'whatsapp_config' para configurações"
    echo "   ✓ Todas as coleções existentes mantidas"
    echo ""
    echo "🧪 PRÓXIMOS PASSOS:"
    echo "1. Recarregue a página da aplicação"
    echo "2. Vá para Cotações → Aprovações"
    echo "3. Clique em 'Testar Sistema de Notificações'"
    echo "4. Verifique se o sino aparece com notificação"
    echo "5. Teste o histórico completo de notificações"
    echo ""
    echo "🔍 Para verificar se as regras foram aplicadas:"
    echo "   firebase firestore:rules get"
else
    echo "❌ Erro ao aplicar regras. Verifique se você está autenticado:"
    echo "   firebase login"
fi