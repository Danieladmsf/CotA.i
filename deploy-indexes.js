#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔥 Firebase Firestore Indexes Deployment Script');
console.log('='.repeat(50));

// Check if firestore.indexes.json exists
const indexesPath = path.join(__dirname, 'firestore.indexes.json');
if (!fs.existsSync(indexesPath)) {
  console.error('❌ firestore.indexes.json not found');
  process.exit(1);
}

// Read and validate indexes file
let indexesConfig;
try {
  indexesConfig = JSON.parse(fs.readFileSync(indexesPath, 'utf8'));
  console.log(`✅ Found ${indexesConfig.indexes.length} indexes to deploy`);
  
  // Show notification indexes
  const notificationIndexes = indexesConfig.indexes.filter(index => 
    index.collectionGroup === 'notifications'
  );
  console.log(`📋 Notification indexes: ${notificationIndexes.length}`);
  notificationIndexes.forEach((index, i) => {
    const fields = index.fields.map(f => `${f.fieldPath}(${f.order})`).join(', ');
    console.log(`   ${i + 1}. ${fields}`);
  });
} catch (error) {
  console.error('❌ Error reading firestore.indexes.json:', error.message);
  process.exit(1);
}

// Function to run command and handle errors
function runCommand(command, description) {
  console.log(`\n🔧 ${description}...`);
  try {
    const output = execSync(command, { 
      cwd: __dirname, 
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 120000 // 2 minutes timeout
    });
    console.log('✅ Success!');
    if (output.trim()) {
      console.log(output.trim());
    }
    return true;
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) {
      console.log('Output:', error.stdout.toString());
    }
    if (error.stderr) {
      console.error('Error details:', error.stderr.toString());
    }
    return false;
  }
}

// Check if user is logged in
console.log('\n🔍 Checking Firebase authentication...');
try {
  const whoami = execSync('firebase projects:list', { 
    cwd: __dirname, 
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 30000
  });
  
  if (whoami.includes('cotao-online')) {
    console.log('✅ Authenticated and project accessible');
  } else {
    console.log('⚠️  Project cotao-online not found in accessible projects');
  }
} catch (error) {
  console.log('❌ Not authenticated or no access. Attempting deployment anyway...');
}

// Deploy indexes
console.log('\n🚀 Deploying Firestore indexes...');
const deploySuccess = runCommand(
  'firebase deploy --only firestore:indexes --project cotao-online', 
  'Deploying indexes to Firebase'
);

if (deploySuccess) {
  console.log('\n🎉 Deployment completed successfully!');
  console.log('📝 Note: Indexes may take a few minutes to build in Firebase Console');
  console.log('🔗 Monitor progress at: https://console.firebase.google.com/project/cotao-online/firestore/indexes');
  console.log('\n⏳ Expected index build time: 2-10 minutes depending on data size');
  console.log('✨ Once built, the notification system errors should be resolved');
} else {
  console.log('\n⚠️  Deployment failed. Trying alternative approaches...');
  
  // Try with different flags
  console.log('\n🔄 Attempting deployment with force flag...');
  const forceSuccess = runCommand(
    'firebase deploy --only firestore:indexes --project cotao-online --force', 
    'Force deploying indexes'
  );
  
  if (!forceSuccess) {
    console.log('\n❌ Deployment failed. Manual intervention may be required.');
    console.log('\n🛠️  Manual deployment options:');
    console.log('1. Run: firebase login');
    console.log('2. Run: firebase deploy --only firestore:indexes');
    console.log('3. Or manually create indexes in Firebase Console:');
    console.log('   https://console.firebase.google.com/project/cotao-online/firestore/indexes');
    console.log('\n📋 Required indexes for notifications:');
    const notificationIndexes = indexesConfig.indexes.filter(index => 
      index.collectionGroup === 'notifications'
    );
    notificationIndexes.forEach((index, i) => {
      const fields = index.fields.map(f => `${f.fieldPath} (${f.order})`).join(', ');
      console.log(`   ${i + 1}. Collection: notifications, Fields: ${fields}`);
    });
  }
}

console.log('\n' + '='.repeat(50));
console.log('🏁 Script completed');