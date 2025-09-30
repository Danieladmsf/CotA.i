
const { exec } = require('child_process');
const urls = [
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=shopping_list_items,quotationId:asc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=supply_categories,name_lowercase:asc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,userId:asc,isRead:asc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,userId:asc,quotationId:asc,createdAt:desc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,userId:asc,type:asc,createdAt:desc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,userId:asc,isRead:asc,createdAt:desc",
  "https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=pending_brand_requests,userId:asc,status:asc"
];

console.log('🚀 Abrindo todas as URLs para criar índices...');
urls.forEach((url, i) => {
  setTimeout(() => {
    console.log(`${i + 1}. Abrindo: ${url.split('create_composite=')[1]}`);
    exec(`open "${url}" || xdg-open "${url}" || start "${url}"`, (error) => {
      if (error) {
        console.log(`   ⚠️  URL copiada para clipboard: ${url}`);
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
