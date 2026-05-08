import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import fs from 'fs';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Get Supabase credentials from environment variables
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey || !supabaseServiceKey) {
  console.error('Error: Missing required environment variables');
  console.error('Please ensure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_KEY are set in your .env file');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function duplicateDatabase() {
  try {
    console.log('Starting database duplication process...');
    
    // 1. Create a timestamp for the backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `supabase-backup-${timestamp}.sql`;
    const backupPath = join(process.cwd(), 'backups', backupFileName);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(join(process.cwd(), 'backups'))) {
      fs.mkdirSync(join(process.cwd(), 'backups'));
    }

    console.log('Creating database backup...');
    
    // 2. Get the database connection string from Supabase
    const { data: dbInfo, error: dbInfoError } = await supabase
      .rpc('get_db_connection_string');
    
    if (dbInfoError) throw dbInfoError;
    
    // 3. Create a backup using pg_dump
    try {
      execSync(`pg_dump ${dbInfo} > ${backupPath}`, { stdio: 'inherit' });
      console.log(`Backup created at: ${backupPath}`);
    } catch (error) {
      console.error('Error creating database backup:');
      console.error('Make sure you have pg_dump installed and in your PATH');
      console.error('You can install it with: brew install libpq');
      console.error('Then add to your PATH: echo \'export PATH="/opt/homebrew/opt/libpq/bin:$PATH"\' >> ~/.zshrc');
      throw error;
    }
    
    // 4. Create a new database in Supabase
    console.log('Creating new database...');
    const newDbName = `duplicate_${timestamp.replace(/[:.-]/g, '_')}`;
    
    const { data: createDbResult, error: createDbError } = await supabase
      .rpc('create_database', { db_name: newDbName });
      
    if (createDbError) throw createDbError;
    
    console.log(`New database created: ${newDbName}`);
    
    // 5. Restore the backup to the new database
    console.log('Restoring backup to new database...');
    
    // Get connection string for the new database
    const newDbConnectionString = dbInfo.replace(/dbname=[^\s]+/, `dbname=${newDbName}`);
    
    try {
      execSync(`psql ${newDbConnectionString} < ${backupPath}`, { stdio: 'inherit' });
      console.log('Database restoration completed successfully!');
    } catch (error) {
      console.error('Error restoring database:');
      console.error('Make sure you have psql installed and in your PATH');
      console.error('You can install it with: brew install libpq');
      throw error;
    }
    
    console.log('\n🎉 Database duplication completed successfully!');
    console.log(`Original database backed up to: ${backupPath}`);
    console.log(`New database name: ${newDbName}`);
    
  } catch (error) {
    console.error('Error duplicating database:');
    console.error(error);
    process.exit(1);
  }
}

duplicateDatabase();
