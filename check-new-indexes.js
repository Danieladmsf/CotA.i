#!/usr/bin/env node

console.log('🔍 VERIFICANDO NOVOS ÍNDICES CRIADOS');
console.log('='.repeat(60));

// Índices da lista atual do usuário
const currentIndexes = [
  'whatsapp_session_requests|status+requestedAt',
  'shopping_list_items|userId+listDate+name',
  'quotations|supplierIds+status+deadline', 
  'shopping_list_items|status+listDate',
  'quotations|createdAt+shoppingListDate',
  'supplies|userId+name',
  'shoppingListItems|userId+listDate+name',
  'shopping_list_items|userId+listDate',
  'quotations|status+deadline',
  'shopping_list_items|listId+status',
  'brand_proposals|quotationId+status+createdAt',
  'user_sessions|status+updatedAt',
  'quotations|status+shoppingListDate',
  'fornecedores|userId+empresa',
  'quotations|shoppingListDate+createdAt',
  'quotations|userId+shoppingListDate',
  'shopping_list_items|listDate+status',
  'supply_categories|userId+name',
  'fornecedores|status+empresa',
  'incoming_messages|userId+receivedAt',
  'supplies|userId+categoryId+name',
  'fornecedores|userId+status+empresa',
  'whatsapp_queue|status+createdAt',
  'whatsapp_queue|userId+status+createdAt',
  'incoming_messages|isOutgoing+status+userId+updatedAt',
  'notifications|userId+createdAt',
  'fornecedores|status+userId+empresa',
  'quotations|userId+shoppingListDate+createdAt',
  'incoming_messages|userId+createdAt',
  'shopping_list_items|userId+listDate',
  'quotations|userId+createdAt',
  'quotations|status+deadline'
];

// Índices da lista anterior (antes da criação)
const previousIndexes = [
  'whatsapp_session_requests|status+requestedAt',
  'shopping_list_items|userId+listDate+name',
  'quotations|supplierIds+status+deadline',
  'shopping_list_items|status+listDate',
  'quotations|createdAt+shoppingListDate',
  'supplies|userId+name',
  'shoppingListItems|userId+listDate+name',
  'shopping_list_items|userId+listDate',
  'quotations|status+deadline',
  'shopping_list_items|listId+status',
  'brand_proposals|quotationId+status+createdAt',
  'user_sessions|status+updatedAt',
  'quotations|status+shoppingListDate',
  'fornecedores|userId+empresa',
  'quotations|shoppingListDate+createdAt',
  'quotations|userId+shoppingListDate',
  'shopping_list_items|listDate+status',
  'supply_categories|userId+name',
  'fornecedores|status+empresa',
  'incoming_messages|userId+receivedAt',
  'supplies|userId+categoryId+name',
  'fornecedores|userId+status+empresa',
  'whatsapp_queue|status+createdAt',
  'whatsapp_queue|userId+status+createdAt',
  'incoming_messages|isOutgoing+status+userId+updatedAt',
  'notifications|userId+createdAt',
  'fornecedores|status+userId+empresa',
  'quotations|userId+shoppingListDate+createdAt',
  'incoming_messages|userId+createdAt',
  'shopping_list_items|userId+listDate',
  'quotations|userId+createdAt',
  'quotations|status+deadline'
];

// Índices que DEVERIAM ter sido criados
const expectedNewIndexes = [
  'shopping_list_items|quotationId',
  'supply_categories|name_lowercase', 
  'notifications|userId+isRead',
  'notifications|userId+quotationId+createdAt',
  'notifications|userId+type+createdAt',
  'notifications|userId+isRead+createdAt',
  'pending_brand_requests|userId+status'
];

// Comparar listas
const newIndexes = currentIndexes.filter(index => !previousIndexes.includes(index));
const missingFromExpected = expectedNewIndexes.filter(index => !currentIndexes.includes(index));

console.log('📊 RESULTADO DA ANÁLISE:');
console.log('-'.repeat(40));

if (newIndexes.length === 0) {
  console.log('❌ NENHUM NOVO ÍNDICE FOI CRIADO');
  console.log('');
  console.log('📋 STATUS: Exatamente os mesmos 32 índices de antes');
  console.log('');
} else {
  console.log(`✅ ${newIndexes.length} NOVOS ÍNDICES DETECTADOS:`);
  newIndexes.forEach((index, i) => {
    console.log(`   ${i + 1}. ${index}`);
  });
  console.log('');
}

console.log('❌ ÍNDICES AINDA FALTANDO:');
console.log('-'.repeat(40));

if (missingFromExpected.length === 0) {
  console.log('🎉 TODOS OS 7 ÍNDICES NECESSÁRIOS FORAM CRIADOS!');
  console.log('✅ Sistema está 100% otimizado!');
} else {
  console.log(`❌ Ainda faltam ${missingFromExpected.length} de 7 índices:`);
  missingFromExpected.forEach((index, i) => {
    console.log(`   ${i + 1}. ${index}`);
  });
  
  console.log('');
  console.log('🔧 AÇÃO NECESSÁRIA:');
  console.log('- Use o arquivo create-indexes-final.html');
  console.log('- Ou clique nos links diretos para criar os faltantes');
}

console.log('');
console.log('📊 RESUMO ESTATÍSTICO:');
console.log('-'.repeat(40));
console.log(`Total atual: ${currentIndexes.length} índices`);
console.log(`Novos criados: ${newIndexes.length}`);
console.log(`Ainda faltando: ${missingFromExpected.length}`);
console.log(`Progresso: ${Math.round(((7 - missingFromExpected.length) / 7) * 100)}% dos 7 necessários`);

// Verificar índices críticos especificamente
const criticalIndexes = [
  'notifications|userId+isRead',
  'notifications|userId+isRead+createdAt',
  'notifications|userId+quotationId+createdAt',
  'notifications|userId+type+createdAt'
];

const criticalMissing = criticalIndexes.filter(index => !currentIndexes.includes(index));

console.log('');
console.log('🚨 VERIFICAÇÃO DE ÍNDICES CRÍTICOS:');
console.log('-'.repeat(40));

if (criticalMissing.length === 0) {
  console.log('✅ TODOS os 4 índices críticos de notifications estão criados!');
  console.log('✅ Debug info deve ter desaparecido!');
} else {
  console.log(`❌ ${criticalMissing.length} de 4 índices críticos ainda faltam:`);
  criticalMissing.forEach((index, i) => {
    console.log(`   ${i + 1}. ${index}`);
  });
  console.log('');
  console.log('⚠️  Por isso o debug info ainda pode aparecer!');
}

console.log('');
console.log('='.repeat(60));