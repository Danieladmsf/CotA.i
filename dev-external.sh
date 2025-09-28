#!/bin/bash

echo "🚀 Iniciando Next.js para acesso externo..."
echo ""

# Mata processos existentes
pkill -f "next dev" 2>/dev/null || true
sleep 2

# Inicia Next.js
npm run dev -- -H 0.0.0.0 -p 3001 &
DEV_PID=$!

# Aguarda inicializar
sleep 5

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