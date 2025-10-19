
const admin = require('firebase-admin');
const qrcode = require('qrcode');
const { serviceAccountCredentials } = require('../lib/services/serviceAccount');

// Inicializar Firebase Admin
try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountCredentials)
  });
} catch (error) {
  console.error('❌ Erro ao inicializar Firebase Admin:', error.message);
  process.exit(1);
}

const db = admin.firestore();

// Listener para user_sessions
db.collection('user_sessions')
  .where('status', '==', 'create_requested')
  .onSnapshot(async (snapshot) => {
    if (snapshot.empty) {
      return;
    }

    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const userId = change.doc.id;
        const data = change.doc.data();


        if (data.status === 'create_requested') {
          await createPlaceholderQrCode(userId);
        }
      }
    }
  }, (error) => {
    console.error('❌ Erro no listener user_sessions:', error);
  });

async function createPlaceholderQrCode(userId) {
  try {

    // Gera um QR code a partir de um texto estático.
    const qrDataUri = await qrcode.toDataURL(`PLACEHOLDER_QR_CODE_FOR_${userId}`);

    await db.collection('user_sessions').doc(userId).update({
      status: 'needs_qr',
      qrCode: qrDataUri, // Salva a imagem Data URI gerada
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

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
  process.exit(0);
});
