// Script para forçar limpeza de TODAS as notificações antigas
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function deleteAllNotifications() {
  console.log('🗑️  Deletando TODAS as notificações...');
  
  // Buscar TODAS as notificações sem filtro
  const snapshot = await db.collection('notifications').get();
  
  if (snapshot.empty) {
    console.log('✅ Nenhuma notificação encontrada');
    return;
  }
  
  console.log(`📋 Encontradas ${snapshot.size} notificações`);
  
  // Deletar em lotes de 500
  const batchSize = 500;
  let batch = db.batch();
  let count = 0;
  
  for (const doc of snapshot.docs) {
    console.log(`  - Deletando: ${doc.id}`);
    batch.delete(doc.ref);
    count++;
    
    if (count % batchSize === 0) {
      await batch.commit();
      batch = db.batch();
      console.log(`  ✅ ${count} notificações deletadas...`);
    }
  }
  
  if (count % batchSize !== 0) {
    await batch.commit();
  }
  
  console.log(`✅ Total: ${count} notificações deletadas`);
}

async function main() {
  try {
    await deleteAllNotifications();
    
    console.log('\n✅ Concluído!');
    console.log('\n⚠️  Agora faça isso no navegador:');
    console.log('   1. Feche TODAS as abas do site');
    console.log('   2. Pressione Ctrl+Shift+Delete');
    console.log('   3. Marque "Dados de cache" e "Cookies"');
    console.log('   4. Clique em "Limpar dados"');
    console.log('   5. Reabra o site');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
