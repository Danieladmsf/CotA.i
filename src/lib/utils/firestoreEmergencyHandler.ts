// Emergency Firestore Error Handler
export class FirestoreEmergencyHandler {
  private static errorCount = 0;
  private static maxErrors = 10;
  private static isEmergencyMode = false;
  
  static init() {
    // Detectar o erro crítico específico
    window.addEventListener('error', (event) => {
      if (event.message?.includes('FIRESTORE') && 
          event.message?.includes('INTERNAL ASSERTION FAILED') &&
          event.message?.includes('b815')) {
        
        this.errorCount++;
        console.error(`🚨 [EMERGENCY] Firestore critical error detected! Count: ${this.errorCount}`);
        
        if (this.errorCount >= this.maxErrors) {
          this.activateEmergencyMode();
        }
      }
    });

    // Detectar console errors repetitivos
    const originalError = console.error;
    console.error = (...args) => {
      const message = args.join(' ');
      if (message.includes('FIRESTORE') && message.includes('b815')) {
        this.errorCount++;
        if (this.errorCount >= this.maxErrors && !this.isEmergencyMode) {
          this.activateEmergencyMode();
        }
        // Não logar o erro para evitar spam
        return;
      }
      originalError.apply(console, args);
    };
  }

  static activateEmergencyMode() {
    console.warn('🚨 [EMERGENCY MODE] Ativando modo de emergência devido a erros críticos do Firestore');
    this.isEmergencyMode = true;
    
    // Limpar todos os dados do Firebase
    try {
      localStorage.clear();
      sessionStorage.clear();
      
      // Tentar limpar IndexedDB do Firebase
      if ('indexedDB' in window) {
        indexedDB.deleteDatabase('firebaseLocalStorageDb');
        indexedDB.deleteDatabase('firebase-app-check-store');
        indexedDB.deleteDatabase('firebase-heartbeat-store');
      }
      
      // Mostrar notificação para o usuário
      this.showEmergencyNotification();
      
    } catch (error) {
      console.error('Erro ao limpar dados do Firebase:', error);
    }
  }

  static showEmergencyNotification() {
    // Criar uma notificação visual para o usuário
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 10px;
      right: 10px;
      background: #ff4444;
      color: white;
      padding: 15px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;
    notification.innerHTML = `
      <strong>⚠️ Problema Detectado</strong><br>
      Recarregando página em 3 segundos para resolver problema de conectividade...
    `;
    
    document.body.appendChild(notification);
    
    // Recarregar a página após 3 segundos
    setTimeout(() => {
      window.location.reload();
    }, 3000);
  }

  static isInEmergencyMode() {
    return this.isEmergencyMode;
  }

  static getEmergencySuppliers() {
    // Dados de fallback em caso de emergência
    return [
      {
        id: 'emergency-1',
        empresa: 'Fornecedor Exemplo 1',
        vendedor: 'Vendedor 1',
        whatsapp: '11999999999',
        fotoUrl: 'https://placehold.co/40x40.png',
        fotoHint: 'Foto padrão',
        status: 'ativo'
      },
      {
        id: 'emergency-2', 
        empresa: 'Fornecedor Exemplo 2',
        vendedor: 'Vendedor 2',
        whatsapp: '11888888888',
        fotoUrl: 'https://placehold.co/40x40.png',
        fotoHint: 'Foto padrão',
        status: 'ativo'
      }
    ];
  }
}

// Inicializar o handler de emergência
if (typeof window !== 'undefined') {
  FirestoreEmergencyHandler.init();
}