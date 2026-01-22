#!/usr/bin/env node
/**
 * Quick migration script for quiz tables
 * Run: node run-migration.js
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('🚀 Running Prisma migration for quiz tables...\n');

try {
  console.log('Step 1: Generating Prisma client...');
  execSync('npx prisma generate', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  console.log('\nStep 2: Creating and applying migration...');
  execSync('npx prisma migrate dev --name add_quizzes', {
    cwd: __dirname,
    stdio: 'inherit',
  });

  console.log('\n✅ Migration completed successfully!');
  console.log('\n📝 Next steps:');
  console.log('   1. Restart your backend server: npm run dev');
  console.log('   2. (Optional) Seed sample quizzes: npm run seed');
} catch (error) {
  console.error('\n❌ Migration failed:', error.message);
  console.log('\n💡 Try running manually:');
  console.log('   cd backend');
  console.log('   npx prisma generate');
  console.log('   npx prisma migrate dev --name add_quizzes');
  process.exit(1);
}
