#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔍 ANÁLISE COMPLETA DE ÍNDICES FALTANTES');
console.log('='.repeat(80));

// Read indexes configuration
const indexesPath = path.join(__dirname, 'firestore.indexes.json');
const indexesConfig = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

// Índices existentes no Firebase (conforme informado pelo usuário)
const existingIndexes = [
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
  'quotations|status+deadline',
  'offers|quotationId'
];

// Function to generate index key
function generateIndexKey(index) {
  const fields = index.fields.map(f => f.fieldPath).join('+');
  return `${index.collectionGroup}|${fields}`;
}

// Analyze missing indexes
const missingIndexes = [];
const existingInCode = [];

indexesConfig.indexes.forEach(index => {
  const key = generateIndexKey(index);
  existingInCode.push(key);
  
  if (!existingIndexes.includes(key)) {
    missingIndexes.push(index);
  }
});

console.log(`📊 ESTATÍSTICAS:`);
console.log(`   Total no código: ${indexesConfig.indexes.length}`);
console.log(`   Total no Firebase: ${existingIndexes.length}`);
console.log(`   Faltando: ${missingIndexes.length}`);
console.log('');

if (missingIndexes.length === 0) {
  console.log('✅ TODOS OS ÍNDICES ESTÃO SINCRONIZADOS!');
} else {
  console.log('❌ ÍNDICES FALTANDO NO FIREBASE:');
  console.log('='.repeat(80));
  
  missingIndexes.forEach((index, i) => {
    console.log(`\n${i + 1}. ÍNDICE FALTANTE:`);
    console.log(`Código da coleção: ${index.collectionGroup}`);
    console.log(`Escopo da consulta: ${index.queryScope === 'COLLECTION' ? 'Coleta' : 'Grupo de coleção'}`);
    console.log(`Campos para indexar:`);
    
    index.fields.forEach((field, j) => {
      const order = field.order === 'ASCENDING' ? 'Crescente' : 'Decrescente';
      console.log(`   ${j + 1}. Caminho do campo: ${field.fieldPath}`);
      console.log(`      Ordem: ${order}`);
    });
    
    console.log(`   ${index.fields.length + 1}. Caminho do campo: __name__`);
    console.log(`      Ordem: Crescente`);
    
    // Generate Firebase Console link
    const fieldsParam = index.fields.map(field => {
      const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
      return `${encodeURIComponent(field.fieldPath)}:${order}`;
    }).join(',');
    
    const directUrl = `https://console.firebase.google.com/project/pagina-cota-i/firestore/indexes?create_composite=${index.collectionGroup},${fieldsParam}`;
    console.log(`\n🔗 Link direto para criar: ${directUrl}`);
    console.log('-'.repeat(60));
  });

  console.log('\n📋 RESUMO RÁPIDO DOS ÍNDICES FALTANTES:');
  console.log('='.repeat(80));
  
  // Group by collection
  const byCollection = {};
  missingIndexes.forEach(index => {
    if (!byCollection[index.collectionGroup]) {
      byCollection[index.collectionGroup] = [];
    }
    byCollection[index.collectionGroup].push(index);
  });

  Object.keys(byCollection).forEach(collection => {
    console.log(`\n📂 ${collection.toUpperCase()}:`);
    byCollection[collection].forEach((index, i) => {
      const fields = index.fields.map(f => f.fieldPath).join(' + ');
      const scope = index.queryScope === 'COLLECTION' ? 'Coleta' : 'Grupo';
      console.log(`   ${i + 1}. ${fields} + __name__ (${scope})`);
    });
  });

  console.log('\n🔧 COMANDOS PARA CRIAR:');
  console.log('='.repeat(80));
  console.log('Option 1: Deploy automático');
  console.log('   firebase deploy --only firestore:indexes');
  console.log('');
  console.log('Option 2: Links diretos (clique um por vez):');
  missingIndexes.forEach((index, i) => {
    const fieldsParam = index.fields.map(field => {
      const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
      return `${encodeURIComponent(field.fieldPath)}:${order}`;
    }).join(',');
    
    const directUrl = `https://console.firebase.google.com/project/pagina-cota-i/firestore/indexes?create_composite=${index.collectionGroup},${fieldsParam}`;
    console.log(`   ${i + 1}. ${directUrl}`);
  });
}

console.log('\n' + '='.repeat(80));
console.log('✨ Análise concluída!');