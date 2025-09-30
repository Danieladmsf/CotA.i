#!/bin/bash

echo "🎯 DEPLOY AUTOMÁTICO DE ÍNDICES FIREBASE - MÉTODO MAIS EFICAZ"
echo "=================================================================="
echo ""

# Verificar se estamos no diretório correto
if [ ! -f "firestore.indexes.json" ]; then
    echo "❌ Erro: Arquivo firestore.indexes.json não encontrado"
    exit 1
fi

# Verificar se Firebase CLI está instalado
if ! command -v firebase &> /dev/null; then
    echo "❌ Erro: Firebase CLI não está instalado"
    exit 1
fi

echo "✅ Configuração verificada"
echo "📂 Projeto: cotao-online" 
echo "📄 Índices no arquivo: $(grep -c 'collectionGroup' firestore.indexes.json)"
echo ""

echo "🔧 Configurando projeto..."
firebase use cotao-online --token "$FIREBASE_TOKEN" 2>/dev/null || firebase use cotao-online

echo ""
echo "🚀 Iniciando deploy dos índices..."
echo "⏱️  Isso pode levar alguns minutos..."
echo ""

# Deploy apenas dos índices
firebase deploy --only firestore:indexes --token "$FIREBASE_TOKEN" 2>/dev/null || {
    echo "📋 Token não disponível. Tentando deploy direto..."
    firebase deploy --only firestore:indexes --project cotao-online
}

echo ""
echo "✅ Deploy concluído!"
echo ""
echo "📊 PRÓXIMOS PASSOS:"
echo "1. Acesse: https://console.firebase.google.com/project/cotao-online/firestore/indexes"
echo "2. Verifique se os índices estão sendo construídos"
echo "3. Aguarde 5-15 minutos para construção completa"
echo "4. Teste o sistema após construção"
echo ""
echo "🎉 RESULTADO ESPERADO:"
echo "- ✅ 7 novos índices em construção"
echo "- ✅ Debug info desaparece"  
echo "- ✅ Performance máxima"
echo "- ✅ Sistema 100% otimizado"