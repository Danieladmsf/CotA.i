#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔗 Firebase Firestore Indexes - Direct Links Generator');
console.log('='.repeat(60));

// Read indexes configuration
const indexesPath = path.join(__dirname, 'firestore.indexes.json');
const indexesConfig = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));

// Filter notification indexes
const notificationIndexes = indexesConfig.indexes.filter(index => 
  index.collectionGroup === 'notifications'
);

console.log(`📋 Found ${notificationIndexes.length} notification indexes to create`);
console.log('\n🔗 Direct creation links for Firebase Console:\n');

// Generate direct URLs for each index
notificationIndexes.forEach((index, i) => {
  console.log(`${i + 1}. Fields: ${index.fields.map(f => `${f.fieldPath} (${f.order})`).join(', ')}`);
  
  // Create URL-encoded field parameters
  const fieldsParam = index.fields.map(field => {
    const order = field.order === 'ASCENDING' ? 'asc' : 'desc';
    return `${encodeURIComponent(field.fieldPath)}:${order}`;
  }).join(',');
  
  const directUrl = `https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,${fieldsParam}`;
  
  console.log(`   🔗 ${directUrl}`);
  console.log('');
});

console.log('📝 Instructions:');
console.log('1. Click on each link above');
console.log('2. Confirm the index creation in Firebase Console');
console.log('3. Wait for indexes to build (2-10 minutes each)');
console.log('4. Monitor progress in Firebase Console');

// Also create URLs from the error messages in the logs
console.log('\n🚨 From the error logs, the specific URL mentioned was:');
console.log('https://console.firebase.google.com/v1/r/project/cotao-online/firestore/indexes?create_composite=ClJwcm9qZWN0cy9jb3Rhby1vbmxpbmUvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL25vdGlmaWNhdGlvbnMvaW5kZXhlcy9fEAEaCgoGdXNlcklkEAEaDQoJY3JlYXRlZEF0EAIaDAoIX19uYW1lX18QAg');

console.log('\n⚡ Quick action - Most important index:');
console.log('https://console.firebase.google.com/project/cotao-online/firestore/indexes?create_composite=notifications,userId:asc,createdAt:desc');

console.log('\n' + '='.repeat(60));
console.log('✨ Once all indexes are created, the notification errors should be resolved!');