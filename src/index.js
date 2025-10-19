
const admin = require('firebase-admin');
const qrcode = require('qrcode');
const { serviceAccountCredentials } = require('../lib/services/serviceAccount');

// Inicializar Firebase Admin
console.log('🔥 Inicializando Firebase Admin...');
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountCredentials)
  });
  console.log('✅ Firebase Admin inicializado com sucesso');
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();
console.log('📊 Conexão com Firestore estabelecida');
console.log('🚀 WhatsApp Bridge (MODO SIMULADO) iniciada...');

// Listener para user_sessions
console.log('👂 Configurando listener para user_sessions...');
db.collection('user_sessions')
  .where('status', '==', 'create_requested')
  .onSnapshot(async (snapshot) => {
    if (snapshot.empty) {
      return;
    }
    console.log(`📡 Recebido snapshot user_sessions: ${snapshot.size} novos pedidos de criação`);

    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const userId = change.doc.id;
        const data = change.doc.data();

        console.log(`🔄 Mudança detectada para usuário ${userId}: status=${data.status}`);

        if (data.status === 'create_requested') {
          console.log(`📱 (SIMULADO) Gerando QR Code de exemplo para usuário: ${userId}`);
          await createPlaceholderQrCode(userId);
        }
      }
    }
  }, (error) => {
    console.error('❌ Erro no listener user_sessions:', error);
  });

async function createPlaceholderQrCode(userId) {
  try {
    console.log(`🔲 Gerando QR Code de exemplo para ${userId}.`);

    // Gera um QR code a partir de um texto estático.
    const qrDataUri = await qrcode.toDataURL(`PLACEHOLDER_QR_CODE_FOR_${userId}`);

    await db.collection('user_sessions').doc(userId).update({
      status: 'needs_qr',
      qrCode: qrDataUri, // Salva a imagem Data URI gerada
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log(`✅ Imagem do QR Code de exemplo salva no Firestore para ${userId}`);

  } catch (error) {
    console.error(`❌ Erro ao criar QR Code de exemplo para ${userId}:`, error.message);
    await db.collection('user_sessions').doc(userId).update({
      status: 'failed',
      error: `Erro ao criar QR Code de exemplo: ${error.message}`,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Encerrando WhatsApp Bridge (MODO SIMULADO)...');
  process.exit(0);
});
