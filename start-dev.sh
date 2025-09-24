#!/bin/bash

# Limpar todos os processos existentes primeiro
echo "🧹 Limpando processos existentes..."
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "serveo.net" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2
echo "✅ Processos limpos!"
echo ""

# Serveo tunnel - URL será exibido após conectar
echo "🚀 Iniciando servidor de desenvolvimento..."
echo "📍 Local: http://localhost:3000"
echo ""

# Função para cleanup quando o script for interrompido
cleanup() {
    echo ""
    echo "🛑 Parando serviços..."
    pkill -f "next dev" 2>/dev/null
    pkill -f "serveo.net" 2>/dev/null
    exit 0
}

# Capturar sinais de interrupção
trap cleanup SIGINT SIGTERM

# Iniciar Next.js em background
npm run dev &
DEV_PID=$!

# Aguardar o servidor iniciar
sleep 3

# Verificar se o servidor está rodando na porta 3000 ou 3001
if curl -s http://localhost:3000 >/dev/null 2>&1; then
    PORT=3000
elif curl -s http://localhost:3001 >/dev/null 2>&1; then
    PORT=3001
else
    echo "❌ Erro: Servidor não iniciou corretamente"
    exit 1
fi

echo "✅ Servidor rodando na porta $PORT"

# Iniciar tunnel Serveo
echo "🔗 Criando tunnel Serveo..."
ssh -R 80:localhost:$PORT serveo.net > /tmp/serveo_output.txt 2>&1 &
TUNNEL_PID=$!

# Aguardar tunnel conectar
sleep 8

# Extrair URL do Serveo
sleep 2  # Aguardar arquivo ser escrito
SERVEO_URL=$(grep -o 'https://[a-zA-Z0-9]*\.serveo\.net' /tmp/serveo_output.txt | head -1)
if [ -z "$SERVEO_URL" ]; then
    echo "❌ Erro: Não foi possível obter URL do Serveo"
    exit 1
fi

echo ""
echo "================================"
echo "🎉 PRONTO PARA DESENVOLVIMENTO!"
echo "================================"
echo "📍 Local:   http://localhost:$PORT"
echo "🌐 Tunnel:  $SERVEO_URL"
echo ""
echo "🔧 CONFIGURAÇÃO GOOGLE OAUTH:"
echo "📝 Adicione estas URLs no Google Cloud Console:"
echo ""
echo "   ORIGENS JAVASCRIPT AUTORIZADAS:"
echo "   ➜ $SERVEO_URL"
echo ""
echo "   URIS DE REDIRECIONAMENTO AUTORIZADOS:"
echo "   ➜ $SERVEO_URL/__/auth/handler"
echo ""
echo "================================"
echo ""
echo "Pressione Ctrl+C para parar todos os serviços"

# Aguardar os processos
wait $DEV_PID $TUNNEL_PID