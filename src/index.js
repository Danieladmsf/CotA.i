
const { Client, LocalAuth } = require('whatsapp-web.js');
const admin = require('firebase-admin');
const qrcode = require('qrcode'); // Importar a nova biblioteca
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

// Armazenar clientes ativos por userId
const activeClients = new Map();

console.log('🚀 WhatsApp Bridge iniciada...');

// Listener para user_sessions
console.log('👂 Configurando listener para user_sessions...');
db.collection('user_sessions')
  .where('status', '==', 'create_requested')
  .onSnapshot(async (snapshot) => {
    if (snapshot.empty) {
      // console.log(`📡 Recebido snapshot user_sessions: 0 documentos com 'create_requested'`);
      return;
    }
    console.log(`📡 Recebido snapshot user_sessions: ${snapshot.size} novos pedidos de criação`);
    
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added' || change.type === 'modified') {
        const userId = change.doc.id;
        const data = change.doc.data();
        
        console.log(`🔄 Mudança detectada para usuário ${userId}: status=${data.status}`);
        
        if (data.status === 'create_requested' && !activeClients.has(userId)) {
          console.log(`📱 Criando sessão para usuário: ${userId}`);
          await createWhatsAppSession(userId);
        }
      }
    }
  }, (error) => {
    console.error('❌ Erro no listener user_sessions:', error);
  });

// Listener para mensagens pendentes
console.log('👂 Configurando listener para mensagens de saída pendentes...');
db.collection('incoming_messages')
  .where('isOutgoing', '==', true)
  .where('status', '==', 'pending')
  .onSnapshot(async (snapshot) => {
    if (snapshot.empty) {
      return;
    }
    console.log(`📡 Recebido snapshot incoming_messages: ${snapshot.size} mensagens pendentes`);
    
    for (const change of snapshot.docChanges()) {
      if (change.type === 'added') {
        const messageDoc = change.doc;
        const messageData = messageDoc.data();
        
        console.log(`📤 Nova mensagem para envio na fila: ${messageDoc.id} -> ${messageData.phoneNumber}`);
        await sendMessage(messageDoc.id, messageData);
      }
    }
  }, (error) => {
    console.error('❌ Erro no listener incoming_messages:', error);
  });

async function createWhatsAppSession(userId) {
  try {
    const client = new Client({
      authStrategy: new LocalAuth({ clientId: userId, dataPath: '/home/user/whatsapp-bridge/.wwebjs_auth' }),
      puppeteer: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu',
        ]
      }
    });

    client.on('qr', async (qr_string) => {
      console.log(`🔲 String do QR Code recebida para ${userId}. Convertendo para imagem...`);
      
      try {
        // ==================================================================
        // AQUI ESTÁ A LÓGICA CORRIGIDA: Usamos a biblioteca 'qrcode' para
        // converter a string de sessão complexa em uma imagem Data URI.
        // ==================================================================
        const qrDataUri = await qrcode.toDataURL(qr_string);
        
        await db.collection('user_sessions').doc(userId).update({
          status: 'needs_qr',
          qrCode: qrDataUri, // Salvamos a imagem Data URI gerada
          generatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        console.log(`✅ Imagem do QR Code salva no Firestore para ${userId}`);
      } catch (err) {
        console.error(`❌ Erro ao converter QR code para imagem para ${userId}:`, err);
      }
    });

    client.on('ready', async () => {
      console.log(`✅ Cliente conectado e pronto para ${userId}`);
      activeClients.set(userId, client);
      
      await db.collection('user_sessions').doc(userId).update({
        status: 'connected',
        qrCode: null, // Limpa o QR code ao conectar
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    client.on('disconnected', async (reason) => {
      console.log(`🔌 Cliente desconectado para ${userId}: ${reason}`);
      activeClients.delete(userId);
      
      await db.collection('user_sessions').doc(userId).update({
        status: 'disconnected',
        disconnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    client.on('auth_failure', async (msg) => {
      console.log(`🚫 Falha de autenticação para ${userId}: ${msg}`);
      activeClients.delete(userId);
      
      await db.collection('user_sessions').doc(userId).update({
        status: 'failed',
        error: `Authentication failure: ${msg}`,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    client.on('message', async (message) => {
      console.log(`📥 Mensagem recebida de ${message.from} para ${userId}`);
      
      const contact = await message.getContact();
      const phoneNumber = contact.number;
      
      await db.collection('incoming_messages').add({
        isOutgoing: false,
        status: 'received',
        phoneNumber: phoneNumber,
        supplierName: contact.name || contact.pushname || phoneNumber,
        message: message.body,
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    await client.initialize();
    
  } catch (error) {
    console.error(`❌ Erro ao criar sessão para ${userId}:`, error.message);
    
    await db.collection('user_sessions').doc(userId).update({
      status: 'failed',
      error: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

async function sendMessage(messageDocId, messageData) {
  try {
    const client = activeClients.get(messageData.userId);
    
    if (!client) {
      throw new Error(`Cliente para o usuário ${messageData.userId} não está conectado.`);
    }

    const chatId = `${messageData.phoneNumber}@c.us`;
    await client.sendMessage(chatId, messageData.message);
    
    console.log(`✅ Mensagem ${messageDocId} enviada para ${messageData.phoneNumber}`);
    
    await db.collection('incoming_messages').doc(messageDocId).update({
      status: 'sent',
      sentAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
  } catch (error) {
    console.error(`❌ Erro ao enviar mensagem ${messageDocId}:`, error.message);
    
    await db.collection('incoming_messages').doc(messageDocId).update({
      status: 'failed',
      error: error.message,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
}

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('🛑 Encerrando WhatsApp Bridge...');
  
  for (const [userId, client] of activeClients) {
    try {
      await client.destroy();
      console.log(`📱 Cliente ${userId} encerrado`);
    } catch (error) {
      console.error(`❌ Erro ao encerrar cliente ${userId}:`, error);
    }
  }
  
  process.exit(0);
});
