// Script para limpar dados de teste
// Execute: node clear-test-data.js

const admin = require('firebase-admin');

// Inicializar Admin SDK
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

async function clearCollection(collectionName) {
  console.log(`🗑️  Limpando coleção: ${collectionName}`);
  
  const snapshot = await db.collection(collectionName).get();
  
  if (snapshot.empty) {
    console.log(`✅ Coleção ${collectionName} já está vazia`);
    return;
  }
  
  const batch = db.batch();
  snapshot.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  await batch.commit();
  console.log(`✅ ${snapshot.size} documentos deletados de ${collectionName}`);
}

async function clearSubcollections() {
  console.log('🗑️  Limpando subcoleções de offers...');
  
  // Buscar todas as quotations
  const quotationsSnapshot = await db.collection('quotations').get();
  
  for (const quotationDoc of quotationsSnapshot.docs) {
    // Para cada quotation, buscar produtos
    const productsSnapshot = await db.collection('quotations')
      .doc(quotationDoc.id)
      .collection('products')
      .get();
    
    for (const productDoc of productsSnapshot.docs) {
      // Para cada produto, deletar offers
      const offersSnapshot = await db.collection('quotations')
        .doc(quotationDoc.id)
        .collection('products')
        .doc(productDoc.id)
        .collection('offers')
        .get();
      
      const batch = db.batch();
      offersSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      if (!offersSnapshot.empty) {
        await batch.commit();
        console.log(`✅ ${offersSnapshot.size} offers deletadas de quotation ${quotationDoc.id}/product ${productDoc.id}`);
      }
    }
  }
}

async function main() {
  try {
    console.log('🚀 Iniciando limpeza de dados de teste...\n');
    
    // Limpar coleções principais
    await clearCollection('notifications');
    await clearCollection('pending_brand_requests');
    
    // Limpar subcoleções
    await clearSubcollections();
    
    console.log('\n✅ Limpeza concluída!');
    console.log('\n⚠️  IMPORTANTE: Limpe também o cache do navegador:');
    console.log('   1. Abra DevTools (F12)');
    console.log('   2. Application > Storage > Clear site data');
    console.log('   3. Recarregue a página (Ctrl+Shift+R)');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

main();
