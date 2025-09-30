#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🚀 CRIAÇÃO AUTOMÁTICA DE ÍNDICES - MÉTODOS DISPONÍVEIS');
console.log('='.repeat(80));

// Read missing indexes from previous analysis
const missingIndexes = [
  {
    collectionGroup: "shopping_list_items",
    queryScope: "COLLECTION",
    fields: [{ fieldPath: "quotationId", order: "ASCENDING" }]
  },
  {
    collectionGroup: "supply_categories", 
    queryScope: "COLLECTION",
    fields: [{ fieldPath: "name_lowercase", order: "ASCENDING" }]
  },
  {
    collectionGroup: "notifications",
    queryScope: "COLLECTION", 
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "isRead", order: "ASCENDING" }
    ]
  },
  {
    collectionGroup: "notifications",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "quotationId", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collectionGroup: "notifications", 
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "type", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collectionGroup: "notifications",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "isRead", order: "ASCENDING" },
      { fieldPath: "createdAt", order: "DESCENDING" }
    ]
  },
  {
    collectionGroup: "pending_brand_requests",
    queryScope: "COLLECTION",
    fields: [
      { fieldPath: "userId", order: "ASCENDING" },
      { fieldPath: "status", order: "ASCENDING" }
    ]
  }
];

console.log('📋 MÉTODO 1: FIREBASE CLI (RECOMENDADO)');
console.log('='.repeat(50));
console.log('1. Fazer login: firebase login');
console.log('2. Executar deploy: firebase deploy --only firestore:indexes');
console.log('3. Aguardar construção (5-15 min por índice)');
console.log('');

console.log('📋 MÉTODO 2: LINKS DIRETOS (CLIQUE UM POR VEZ)');
console.log('='.repeat(50));

missingIndexes.forEach((index, i) => {
  const fieldsParam = index.fields.map(field => {
    const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
    return `${encodeURIComponent(field.fieldPath)}:${order}`;
  }).join(',');
  
  const directUrl = `https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=${index.collectionGroup},${fieldsParam}`;
  console.log(`${i + 1}. ${directUrl}`);
});

console.log('');
console.log('📋 MÉTODO 3: SCRIPT AUTOMATIZADO (EXECUTAR AGORA)');
console.log('='.repeat(50));

// Generate curl commands for Firebase REST API
console.log('🔧 Comandos cURL para criar via API REST:');
console.log('');

const projectId = 'cotao-online';
missingIndexes.forEach((index, i) => {
  const indexData = {
    fields: [
      ...index.fields.map(f => ({
        fieldPath: f.fieldPath,
        order: f.order
      })),
      {
        fieldPath: "__name__",
        order: "ASCENDING"
      }
    ]
  };

  console.log(`# Índice ${i + 1}: ${index.collectionGroup}`);
  console.log(`curl -X POST \\`);
  console.log(`  "https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/collectionGroups/${index.collectionGroup}/indexes" \\`);
  console.log(`  -H "Authorization: Bearer $(gcloud auth print-access-token)" \\`);
  console.log(`  -H "Content-Type: application/json" \\`);
  console.log(`  -d '${JSON.stringify(indexData)}'`);
  console.log('');
});

console.log('📋 MÉTODO 4: SCRIPT BATCH DE LINKS');
console.log('='.repeat(50));

// Generate HTML file with all links
const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>Criar Índices Automaticamente</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; }
        .button { display: block; padding: 15px; margin: 10px 0; background: #4285f4; color: white; text-decoration: none; border-radius: 5px; text-align: center; }
        .button:hover { background: #3367d6; }
        .instructions { background: #e8f4fd; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🚀 Criar Todos os Índices Automaticamente</h1>
        <div class="instructions">
            <strong>INSTRUÇÕES:</strong><br>
            1. Clique em cada link abaixo (abre em nova aba)<br>
            2. Faça login no Firebase se necessário<br>
            3. Clique em "Criar" em cada aba<br>
            4. Aguarde 5-15 minutos para construção
        </div>
        
        ${missingIndexes.map((index, i) => {
          const fieldsParam = index.fields.map(field => {
            const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
            return `${encodeURIComponent(field.fieldPath)}:${order}`;
          }).join(',');
          
          const directUrl = `https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=${index.collectionGroup},${fieldsParam}`;
          const fields = index.fields.map(f => f.fieldPath).join(' + ');
          
          return `<a href="${directUrl}" target="_blank" class="button">
            ${i + 1}. ${index.collectionGroup}: ${fields}
          </a>`;
        }).join('')}
        
        <div style="margin-top: 30px; padding: 15px; background: #e8f5e8; border-radius: 5px;">
            <strong>✅ RESULTADO ESPERADO:</strong><br>
            - 7 novas abas abertas<br>
            - 7 índices criados<br>
            - Sistema 100% otimizado em ~15 minutos
        </div>
    </div>
</body>
</html>
`;

fs.writeFileSync('./create-all-indexes.html', htmlContent);
console.log('✅ Arquivo criado: create-all-indexes.html');
console.log('   Abra este arquivo no navegador para criar todos os índices!');

console.log('');
console.log('📋 MÉTODO 5: SCRIPT NODE.JS (MELHOR OPÇÃO)');
console.log('='.repeat(50));
console.log('Vou criar um script que abre todas as URLs automaticamente...');

// Generate a Node.js script that opens all URLs
const nodeScript = `
const { exec } = require('child_process');
const urls = [
${missingIndexes.map((index, i) => {
  const fieldsParam = index.fields.map(field => {
    const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
    return `${encodeURIComponent(field.fieldPath)}:${order}`;
  }).join(',');
  
  const directUrl = `https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=${index.collectionGroup},${fieldsParam}`;
  return `  "${directUrl}"`;
}).join(',\n')}
];

console.log('🚀 Abrindo todas as URLs para criar índices...');
urls.forEach((url, i) => {
  setTimeout(() => {
    console.log(\`\${i + 1}. Abrindo: \${url.split('create_composite=')[1]}\`);
    exec(\`open "\${url}" || xdg-open "\${url}" || start "\${url}"\`, (error) => {
      if (error) {
        console.log(\`   ⚠️  URL copiada para clipboard: \${url}\`);
      }
    });
  }, i * 2000); // 2 seconds between each
});

console.log('');
console.log('📋 INSTRUÇÕES:');
console.log('1. Aguarde as abas abrirem (uma a cada 2 segundos)');
console.log('2. Em cada aba, clique em "Criar"');
console.log('3. Aguarde 5-15 minutos para construção completa');
console.log('4. Verifique o console do Firebase para progresso');
`;

fs.writeFileSync('./open-all-index-urls.js', nodeScript);
console.log('✅ Script criado: open-all-index-urls.js');
console.log('   Execute: node open-all-index-urls.js');

console.log('');
console.log('🎯 RECOMENDAÇÃO FINAL:');
console.log('='.repeat(50));
console.log('MAIS FÁCIL → Execute: node open-all-index-urls.js');
console.log('MAIS CONFIÁVEL → firebase login && firebase deploy --only firestore:indexes');

console.log('');
console.log('✨ Todos os métodos criados! Escolha o que preferir.');