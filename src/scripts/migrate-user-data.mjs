
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// Firebase Admin credentials from environment variables
const serviceAccountCredentials = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
};

// Validate required environment variables
if (!serviceAccountCredentials.project_id || !serviceAccountCredentials.private_key || !serviceAccountCredentials.client_email) {
  console.error("\n\n❌ ERRO: Variáveis de ambiente do Firebase Admin não configuradas.");
  console.error("Configure as seguintes variáveis:");
  console.error("- FIREBASE_PROJECT_ID");
  console.error("- FIREBASE_PRIVATE_KEY");
  console.error("- FIREBASE_CLIENT_EMAIL\n\n");
  process.exit(1);
}

// ==========================================================================================
//  INSTRUÇÕES
// ==========================================================================================
// 1. VÁ PARA O CONSOLE DO FIREBASE: https://console.firebase.google.com/
// 2. SELECIONE SEU PROJETO 'cotao-online'.
// 3. CLIQUE EM 'AUTHENTICATION' NO MENU ESQUERDO.
// 4. NA ABA 'USERS', ENCONTRE SUA CONTA E COPIE O 'USER UID'.
// 5. COLE O SEU UID AQUI ABAIXO, NO LUGAR DE "PUT_YOUR_USER_ID_HERE".
// 6. SALVE O ARQUIVO.
// 7. ABRA O TERMINAL NA PASTA DO SEU PROJETO E RODE O COMANDO:
//    node src/scripts/migrate-user-data.mjs
// ==========================================================================================
const TARGET_USER_ID = "PUT_YOUR_USER_ID_HERE";
// ==========================================================================================

if (TARGET_USER_ID === "PUT_YOUR_USER_ID_HERE") {
  console.error("\n\n❌ ERRO: Por favor, edite este arquivo (src/scripts/migrate-user-data.mjs) e substitua 'PUT_YOUR_USER_ID_HERE' pelo seu User UID do Firebase Authentication.\n\n");
  process.exit(1);
}

// Inicializa o Firebase Admin SDK
try {
  initializeApp({
    credential: cert(serviceAccountCredentials),
  });
} catch (error) {
  if (!/already exists/.test(error.message)) {
    console.error('Firebase initialization error:', error.stack);
    process.exit(1);
  }
}

const db = getFirestore();

const collectionsToMigrate = [
    'fornecedores', 
    'supplies', 
    'supply_categories', 
    'quotations', 
    'shopping_list_items',
    'whatsapp_queue',
    'whatsapp_conversations'
];

async function migrateCollection(collectionName) {
  console.log(`\n--- Iniciando migração para a coleção: "${collectionName}" ---`);
  const collectionRef = db.collection(collectionName);
  
  // Busca documentos que NÃO possuem o campo 'userId'
  const snapshot = await collectionRef.where('userId', '==', null).get();

  if (snapshot.empty) {
    console.log(`✅ Nenhum documento órfão encontrado em "${collectionName}".`);
    return { migrated: 0, skipped: 0 };
  }

  console.log(`🔎 Encontrados ${snapshot.size} documentos para migrar em "${collectionName}".`);
  
  let migratedCount = 0;
  const batch = db.batch();

  snapshot.forEach(doc => {
    batch.update(doc.ref, { userId: TARGET_USER_ID });
    migratedCount++;
  });
  
  await batch.commit();
  console.log(`🎉 Migrados ${migratedCount} documentos em "${collectionName}" para o usuário ${TARGET_USER_ID}.`);
  return { migrated: migratedCount, skipped: 0 };
}

async function runMigration() {
  console.log("=================================================");
  console.log("🚀 INICIANDO SCRIPT DE MIGRAÇÃO DE DADOS 🚀");
  console.log(`Atribuindo dados órfãos para o User ID: ${TARGET_USER_ID}`);
  console.log("=================================================");
  
  let totalMigrated = 0;

  for (const collectionName of collectionsToMigrate) {
    try {
      const result = await migrateCollection(collectionName);
      totalMigrated += result.migrated;
    } catch (error) {
      console.error(`❌ Erro ao migrar a coleção "${collectionName}":`, error.message);
      if (error.details && error.details.includes('index')) {
        console.error("👉 Parece que um índice necessário está faltando. Verifique os logs de erro no console do Firebase para criar o índice necessário e tente novamente.");
      }
    }
  }

  console.log("\n=================================================");
  console.log("✨ MIGRAÇÃO CONCLUÍDA ✨");
  console.log(`Total de documentos atualizados: ${totalMigrated}`);
  console.log("=================================================");
  process.exit(0);
}

runMigration();
