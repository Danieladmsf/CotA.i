#!/usr/bin/env node

console.log('🔧 SOLUÇÃO PARA BOTÃO "Salvar e Avançar" NÃO FUNCIONANDO');
console.log('='.repeat(70));

console.log('\n🎯 PROBLEMA IDENTIFICADO:');
console.log('O botão está desabilitado quando: pendingItemsToSaveCount === 0');
console.log('');

console.log('📋 CAUSAS MAIS COMUNS:');
console.log('');

console.log('1️⃣ NENHUM ITEM ADICIONADO À LISTA');
console.log('   ❌ Você clicou em "Adicionar" mas não inseriu quantidade');
console.log('   ❌ Quantidade está vazia ou zero'); 
console.log('   ✅ SOLUÇÃO: Adicione itens e defina quantidade > 0');
console.log('');

console.log('2️⃣ PROBLEMA DE CARREGAMENTO (ÍNDICES FALTANTES)');
console.log('   ❌ Sistema não consegue carregar insumos/categorias');
console.log('   ❌ isLoadingData = true permanentemente');
console.log('   ✅ SOLUÇÃO: Criar índices faltantes primeiro');
console.log('');

console.log('3️⃣ PROBLEMAS DE ESTADO/JAVASCRIPT');
console.log('   ❌ Estados React dessincronizados');
console.log('   ❌ Erros no console do navegador');
console.log('   ✅ SOLUÇÃO: Recarregar página + verificar console');
console.log('');

console.log('🔧 PASSOS PARA RESOLVER:');
console.log('='.repeat(50));

console.log('\n📍 PASSO 1: VERIFICAÇÃO BÁSICA');
console.log('1. Abra a página "Programar Compra" → "Passo 1: Criar Lista"');
console.log('2. Verifique se aparecem insumos do lado esquerdo');
console.log('3. Verifique se há mensagens de erro');
console.log('');

console.log('📍 PASSO 2: TESTE ADICIONAR ITEM');
console.log('1. Clique em "Adicionar" em qualquer insumo');
console.log('2. O item deve aparecer do lado direito');
console.log('3. Digite uma quantidade > 0 (ex: 10)');
console.log('4. O botão deve mostrar "Salvar e Avançar (1)"');
console.log('');

console.log('📍 PASSO 3: DEBUG AVANÇADO');
console.log('Se ainda não funcionar, no console do navegador (F12):');
console.log('');

const debugScript = `
// 🔍 SCRIPT DE DEBUG COMPLETO
console.clear();
console.log('🔧 DIAGNÓSTICO BOTÃO SALVAR E AVANÇAR');

// 1. Encontrar o botão
const saveButton = Array.from(document.querySelectorAll('button')).find(btn => 
  btn.textContent.includes('Salvar e Avançar') || 
  btn.textContent.includes('Salvar e Cotar')
);

if (saveButton) {
  console.log('✅ Botão encontrado:', saveButton.textContent);
  console.log('❌ Desabilitado?', saveButton.disabled);
  
  // Extrair contador
  const match = saveButton.textContent.match(/\\((\\d+)\\)/);
  const count = match ? parseInt(match[1]) : 0;
  console.log('📊 Itens pendentes:', count);
  
  if (count === 0) {
    console.log('❌ PROBLEMA: Nenhum item válido na lista');
    console.log('🔧 AÇÃO: Adicione itens com quantidade > 0');
  } else {
    console.log('✅ Itens na lista OK');
    console.log('🔍 Verificando outros problemas...');
    
    // Verificar se está carregando
    const loader = document.querySelector('[class*="animate-spin"]');
    if (loader) {
      console.log('⏳ Sistema ainda carregando');
    }
  }
} else {
  console.log('❌ Botão não encontrado - página incorreta?');
}

// 2. Verificar itens na lista
const listItems = document.querySelectorAll('input[type="number"]');
console.log('🔢 Inputs de quantidade encontrados:', listItems.length);

let validItems = 0;
listItems.forEach((input, i) => {
  const value = parseFloat(input.value);
  console.log(\`   Item \${i + 1}: "\${input.value}" → \${isNaN(value) ? 'INVÁLIDO' : value}\`);
  if (!isNaN(value) && value > 0) validItems++;
});

console.log(\`📈 Itens com quantidade válida: \${validItems}\`);

// 3. Verificar erros no console
const errors = console.error.toString();
console.log('🐛 Verificar se há erros vermelhos acima');

// 4. Forçar atualização (último recurso)
console.log('');
console.log('🔄 PARA FORÇAR CORREÇÃO, execute:');
console.log('window.location.reload()');
`;

console.log(debugScript);

console.log('\n📍 PASSO 4: SOLUÇÕES ESPECÍFICAS');
console.log('='.repeat(50));

console.log('\n🔧 SE count = 0 (mais comum):');
console.log('   1. Clique "Adicionar" em um insumo');
console.log('   2. Digite quantidade > 0');
console.log('   3. Botão deve ficar habilitado');
console.log('');

console.log('🔧 SE Sistema carregando (isLoadingData = true):');
console.log('   1. Crie os índices faltantes primeiro');
console.log('   2. Aguarde 5-10 minutos');
console.log('   3. Recarregue a página');
console.log('');

console.log('🔧 SE JavaScript com erro:');
console.log('   1. Recarregue a página (Ctrl+F5)');
console.log('   2. Limpe cache do navegador');
console.log('   3. Tente em aba privada');
console.log('');

console.log('🔧 SE nada funcionar:');
console.log('   1. Verifique se está logado');
console.log('   2. Verifique permissões no Firebase');
console.log('   3. Tente outro navegador');
console.log('');

console.log('🎯 AÇÃO IMEDIATA RECOMENDADA:');
console.log('='.repeat(50));
console.log('1. Execute o script de debug no console');
console.log('2. Me informe o resultado (especialmente o "count")');
console.log('3. Se count = 0, adicione um item com quantidade');
console.log('4. Se count > 0, o problema é outro - preciso mais detalhes');
console.log('');

console.log('✨ O botão deve funcionar assim que count > 0!');