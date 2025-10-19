#!/bin/bash

echo "🏥 VERIFICAÇÃO DE SAÚDE DO SISTEMA"
echo "=================================="
echo ""

# 1. Verificar Node.js
echo "📦 Node.js:"
node -v 2>/dev/null && echo "   ✅ Instalado" || echo "   ❌ Não instalado"
echo ""

# 2. Verificar npm
echo "📦 npm:"
npm -v 2>/dev/null && echo "   ✅ Instalado" || echo "   ❌ Não instalado"
echo ""

# 3. Verificar processos Next.js
echo "🔍 Processos Next.js:"
if pgrep -f "next dev" > /dev/null; then
    echo "   ✅ Servidor rodando (PID: $(pgrep -f 'next dev'))"
else
    echo "   ❌ Servidor parado"
fi
echo ""

# 4. Verificar porta 3001
echo "🔌 Porta 3001:"
if lsof -Pi :3001 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo "   ✅ Em uso por: $(lsof -i :3001 | grep LISTEN | awk '{print $1}')"
else
    echo "   ❌ Livre"
fi
echo ""

# 5. Verificar cache Next.js
echo "📂 Cache Next.js (.next):"
if [ -d ".next" ]; then
    SIZE=$(du -sh .next 2>/dev/null | cut -f1)
    echo "   ✅ Existe (Tamanho: $SIZE)"
else
    echo "   ❌ Não existe"
fi
echo ""

# 6. Verificar node_modules
echo "📂 node_modules:"
if [ -d "node_modules" ]; then
    SIZE=$(du -sh node_modules 2>/dev/null | cut -f1)
    echo "   ✅ Existe (Tamanho: $SIZE)"
else
    echo "   ❌ Não existe - Execute: npm install"
fi
echo ""

# 7. Verificar .env.local
echo "🔐 Variáveis de ambiente (.env.local):"
if [ -f ".env.local" ]; then
    echo "   ✅ Arquivo existe"
    echo "   📝 Variáveis configuradas:"
    grep -v "^#" .env.local | grep "=" | cut -d "=" -f1 | sed 's/^/      - /'
else
    echo "   ❌ Arquivo não encontrado"
fi
echo ""

# 8. Verificar conexão Firebase
echo "🔥 Firebase:"
if grep -q "NEXT_PUBLIC_FIREBASE_API_KEY" .env.local 2>/dev/null; then
    echo "   ✅ Credenciais configuradas"
else
    echo "   ❌ Credenciais não encontradas"
fi
echo ""

# 9. Memória do sistema
echo "💾 Memória do sistema:"
free -h | grep "Mem:" | awk '{print "   Total: "$2" | Usado: "$3" | Livre: "$4}'
echo ""

# 10. Espaço em disco
echo "💿 Espaço em disco:"
df -h . | tail -1 | awk '{print "   Disponível: "$4" / "$2}'
echo ""

echo "=================================="
echo "✅ Verificação concluída!"
echo ""
echo "💡 Dicas:"
echo "   - Para reiniciar com limpeza: npm run dev:external"
echo "   - Para limpar cache: rm -rf .next"
echo "   - Para verificar logs: tail -f .next/trace"
echo ""
