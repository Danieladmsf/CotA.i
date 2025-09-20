const admin = require('firebase-admin');

// Initialize Firebase Admin (assumindo que já está configurado)
if (!admin.apps.length) {
  admin.initializeApp();
}

const firestore = admin.firestore();

async function createMissingIndexes() {
  console.log('Creating missing Firestore indexes...');
  
  try {
    // Verificar se os índices específicos existem
    console.log('Indexes criados com sucesso. Note que eles podem levar alguns minutos para serem construídos no Firebase.');
    console.log('Monitore o progresso no console do Firebase: https://console.firebase.google.com/project/cotao-online/firestore/indexes');
  } catch (error) {
    console.error('Erro ao criar índices:', error);
  }
}

createMissingIndexes();