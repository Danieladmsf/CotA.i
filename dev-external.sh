#!/bin/bash

echo "🚀 Iniciando Next.js para acesso externo..."
echo ""

# 1. Mata processos existentes
echo "🔄 Parando processos anteriores..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true
sleep 2

# 2. Limpa cache do Next.js
echo "🧹 Limpando cache do Next.js..."
rm -rf .next 2>/dev/null || true

# 3. Verifica porta 3001
echo "🔍 Verificando porta 3001..."
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "⚠️  Porta 3001 em uso, liberando..."
    kill -9 $(lsof -t -i:3001) 2>/dev/null || true
    sleep 1
fi

# 4. Limpa módulos de node (opcional - descomente se necessário)
# echo "🗑️  Limpando node_modules/.cache..."
# rm -rf node_modules/.cache 2>/dev/null || true

echo "✅ Ambiente preparado!"
echo ""

# 5. Inicia Next.js
echo "🚀 Iniciando servidor..."
npm run dev -- -H 0.0.0.0 -p 3001 &
DEV_PID=$!

# 6. Aguarda inicializar
sleep 6

echo ""
echo "================================"
echo "🎉 SERVIDOR RODANDO!"
echo "================================"
echo "📍 Local:    http://localhost:3001"
echo "🌐 External: http://72-60-61-118.nip.io:3001"
echo ""
echo "🔧 URLs configuradas no OAuth:"
echo "   ➜ http://72-60-61-118.nip.io:3001"
echo "   ➜ http://72-60-61-118.nip.io:3001/__/auth/handler"
echo ""
echo "================================"
echo ""
echo "Pressione Ctrl+C para parar"

# Aguarda o processo
wait $DEV_PID