
const { Client, LocalAuth } = require('whatsapp-web.js');
const { getFirestore, doc, setDoc } = require('firebase/firestore');
const { initializeApp } = require('firebase/app');
const { firebaseConfig } = require('../firebaseAdmin');
const logger = require('../utils/logger');
const { handleIncomingMessage, handleMessageAck } = require('../handlers/messageHandler');

const db = getFirestore(initializeApp(firebaseConfig));

class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.sessionsInProgress = new Set(); // Para controlar sessões em andamento
    }

    async createOrRestoreSession(userId) {
        // Lógica de bloqueio para evitar múltiplas criações simultâneas
        if (this.sessionsInProgress.has(userId)) {
            logger.warn(`⚠️ Já existe uma criação de sessão em andamento para ${userId}. Ignorando a nova solicitação.`);
            return;
        }

        if (this.sessions.has(userId)) {
            logger.warn(`⚠️ Tentativa de recriar uma sessão já existente para ${userId}. Verificando status...`);
            const existingClient = this.sessions.get(userId);
            try {
                const state = await existingClient.getState();
                if (state === 'CONNECTED') {
                    logger.info(`✅ A sessão para ${userId} já está conectada. Nenhuma ação necessária.`);
                    return;
                }
            } catch (e) {
                logger.warn(`⚠️ A sessão para ${userId} existe mas não está respondendo. Prosseguindo com a recriação.`);
                await this.shutdownSession(userId); // Garante limpeza antes de recriar
            }
        }
        
        this.sessionsInProgress.add(userId);

        logger.info(`🔄 Criando/Restaurando sessão para usuário: ${userId}`);

        const sessionDocRef = doc(db, "user_sessions", userId);
        let client;

        try {
            client = new Client({
                authStrategy: new LocalAuth({
                    clientId: userId,
                    dataPath: '/home/user/whatsapp-bridge/.wwebjs_auth'
                }),
                puppeteer: {
                    headless: true,
                    args: [
                        '--no-sandbox',
                        '--disable-setuid-sandbox',
                        '--disable-dev-shm-usage',
                        '--disable-accelerated-2d-canvas',
                        '--no-first-run',
                        '--no-zygote',
                        '--single-process', // Isso pode ajudar em alguns ambientes
                        '--disable-gpu'
                    ],
                },
            });
            
            this.sessions.set(userId, client);

            client.on('qr', async (qr) => {
                logger.info(`📸 QR Code gerado para ${userId}.`);
                await setDoc(sessionDocRef, { 
                    status: 'needs_qr', 
                    qrCode: qr, 
                    generatedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            });

            client.on('ready', async () => {
                logger.info(`✅ Cliente pronto para ${userId}!`);
                await setDoc(sessionDocRef, {
                    status: 'connected',
                    qrCode: null,
                    connectedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                this.setupPolling(userId, client);
            });

            client.on('authenticated', async () => {
                logger.info(`🔒 Autenticado com sucesso para ${userId}. Aguardando o cliente ficar pronto.`);
                await setDoc(sessionDocRef, { 
                    status: 'authenticated', 
                    qrCode: null,
                    updatedAt: new Date().toISOString()
                }, { merge: true });
            });

            client.on('auth_failure', async (msg) => {
                logger.error(`❌ Falha na autenticação para ${userId}: ${msg}`);
                await setDoc(sessionDocRef, { status: 'auth_failure', error: msg, updatedAt: new Date().toISOString() }, { merge: true });
            });

            client.on('disconnected', async (reason) => {
                logger.warn(`🔌 Cliente desconectado para ${userId}. Motivo: ${reason}`);
                await setDoc(sessionDocRef, { 
                    status: 'disconnected', 
                    reason: reason, 
                    disconnectedAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                }, { merge: true });
                this.sessions.delete(userId);
            });

            client.on('message', message => handleIncomingMessage(userId, message));
            client.on('message_ack', (msg, ack) => handleMessageAck(userId, msg, ack));
            
            await client.initialize();

        } catch (error) {
            logger.error(`❌ Erro ao criar/restaurar sessão para ${userId}: ${error.message}`);
            await setDoc(sessionDocRef, { 
                status: 'failed', 
                error: error.message, 
                updatedAt: new Date().toISOString()
            }, { merge: true });
            this.sessions.delete(userId); // Limpa a sessão falha
        } finally {
            this.sessionsInProgress.delete(userId); // Libera o bloqueio
        }
    }

    setupPolling(userId, client) {
        logger.info(`🎧 INICIANDO: Sistema de polling para capturar mensagens para ${userId}...`);
                          
        const pollInterval = setInterval(async () => {
            try {
                const chats = await client.getChats();
                
                for (const chat of chats) {
                    if (chat.unreadCount > 0) {
                        const messages = await chat.fetchMessages({ limit: chat.unreadCount });
                        for (const message of messages) {
                            if (!message.fromMe && message.timestamp > (Date.now() - 300000)) { // Últimos 5 minutos
                                logger.info(`🔥 POLLING: Mensagem encontrada: "${message.body}" de ${message.from}`);
                                await handleIncomingMessage(userId, message);
                            }
                        }
                        await chat.sendSeen();
                    }
                }
            } catch (pollError) {
                logger.error(`❌ POLLING erro para ${userId}:`, pollError.message);
                if(pollError.message.includes('Session closed')) {
                    logger.warn(`⏹️ Parando polling para ${userId} devido à sessão fechada.`);
                    clearInterval(pollInterval);
                }
            }
        }, 15000); // Verifica a cada 15 segundos

        client.pollingInterval = pollInterval; // Armazena a referência do intervalo no cliente
    }

    async getClient(userId) {
        const client = this.sessions.get(userId);
        if (!client) {
            logger.warn(`⚠️ Cliente para ${userId} não encontrado.`);
            return null;
        }
        try {
            const state = await client.getState();
            if (state === 'CONNECTED') {
                return client;
            }
        } catch (e) {
            logger.error(`❌ Erro ao verificar estado do cliente para ${userId}: ${e.message}`);
            return null;
        }
        logger.warn(`⚠️ Cliente para ${userId} não está no estado 'CONNECTED'. Estado atual: ${await client.getState()}`);
        return null;
    }

    async shutdownSession(userId) {
        if (this.sessions.has(userId)) {
            logger.info(`🔌 Encerrando sessão para ${userId}...`);
            const client = this.sessions.get(userId);
            if (client.pollingInterval) {
                clearInterval(client.pollingInterval);
            }
            try {
                await client.destroy();
            } catch (e) {
                logger.error(`Erro menor ao destruir cliente (pode já estar fechado): ${e.message}`);
            }
            this.sessions.delete(userId);
            logger.info(`✅ Sessão para ${userId} encerrada.`);
        }
    }

    async shutdownAllSessions() {
        logger.info('🔌 Encerrando todas as sessões...');
        for (const userId of this.sessions.keys()) {
            await this.shutdownSession(userId);
        }
        logger.info('✅ Todas as sessões foram encerradas.');
    }
}

module.exports = new SessionManager();
