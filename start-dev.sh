#!/bin/bash

# Limpar todos os processos existentes primeiro
echo "🧹 Limpando processos existentes..."
pkill -f "next dev" 2>/dev/null
pkill -f "next-server" 2>/dev/null
pkill -f "ngrok" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 2
echo "✅ Processos limpos!"
echo ""

# Ngrok tunnel - URL será exibido após conectar
echo "🚀 Iniciando servidor de desenvolvimento..."
echo "📍 Local: http://localhost:3000"
echo "🔍 Painel: http://localhost:4040"
echo ""

# Função para cleanup quando o script for interrompido
cleanup() {
    echo ""
    echo "🛑 Parando serviços..."
    pkill -f "next dev" 2>/dev/null
    pkill -f "ngrok" 2>/dev/null
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

# Iniciar tunnel ngrok com domínio fixo
echo "🔗 Criando tunnel ngrok com domínio fixo..."
ngrok http --url=sandra-optimal-magistratically.ngrok-free.app $PORT &
TUNNEL_PID=$!

# Aguardar tunnel conectar
sleep 5

# URL fixo do ngrok
FIXED_URL="https://sandra-optimal-magistratically.ngrok-free.app"

echo ""
echo "================================"
echo "🎉 PRONTO PARA DESENVOLVIMENTO!"
echo "================================"
echo "📍 Local:   http://localhost:$PORT"
echo "🌐 Tunnel:  $FIXED_URL (FIXO!)"
echo "🔍 Painel:  http://localhost:4040"
echo "📝 OAuth já configurado com domínio fixo!"
echo "================================"
echo ""
echo "Pressione Ctrl+C para parar todos os serviços"

# Aguardar os processos
wait $DEV_PID $TUNNEL_PID