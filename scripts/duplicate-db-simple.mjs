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
  console.error('❌ Error: Missing required environment variables');
  console.error('Please ensure the following are set in your .env file:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- VITE_SUPABASE_ANON_KEY');
  console.error('- VITE_SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

// Initialize Supabase client with service role key
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Function to check if Supabase CLI is installed
function isSupabaseCliInstalled() {
  try {
    execSync('supabase --version', { stdio: 'ignore' });
    return true;
  } catch (error) {
    return false;
  }
}

// Function to install Supabase CLI if not installed
function ensureSupabaseCli() {
  if (!isSupabaseCliInstalled()) {
    console.log('🔧 Supabase CLI not found. Installing...');
    try {
      // Install Supabase CLI using Homebrew (macOS)
      execSync('brew install supabase/tap/supabase', { stdio: 'inherit' });
      console.log('✅ Supabase CLI installed successfully!');
    } catch (error) {
      console.error('❌ Failed to install Supabase CLI. Please install it manually:');
      console.error('   https://supabase.com/docs/guides/cli/getting-started');
      process.exit(1);
    }
  }
}

async function duplicateDatabase() {
  try {
    console.log('🚀 Starting database duplication process...');
    
    // Ensure Supabase CLI is installed
    ensureSupabaseCli();
    
    // 1. Create a timestamp for the backup
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFileName = `supabase-backup-${timestamp}.sql`;
    const backupDir = join(process.cwd(), 'backups');
    const backupPath = join(backupDir, backupFileName);
    
    // Create backups directory if it doesn't exist
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // 2. Login to Supabase CLI
    console.log('🔑 Logging in to Supabase CLI...');
    try {
      execSync('supabase login', { stdio: 'inherit' });
    } catch (error) {
      console.error('❌ Failed to login to Supabase CLI. Please run `supabase login` manually.');
      process.exit(1);
    }
    
    // 3. Create a backup using Supabase CLI
    console.log('💾 Creating database backup...');
    try {
      execSync(`supabase db dump -f ${backupPath}`, { stdio: 'inherit' });
      console.log(`✅ Backup created at: ${backupPath}`);
    } catch (error) {
      console.error('❌ Error creating database backup:');
      console.error(error.message);
      process.exit(1);
    }
    
        // 4. List available organizations and let user select one
    console.log('📋 Listing available organizations...');
    let orgsOutput;
    try {
      orgsOutput = execSync('supabase orgs list --json', { encoding: 'utf-8' });
    } catch (error) {
      console.error('❌ Failed to list organizations. Please make sure you are logged in with `supabase login`');
      process.exit(1);
    }

    let orgs;
    try {
      orgs = JSON.parse(orgsOutput);
      if (!Array.isArray(orgs) || orgs.length === 0) {
        throw new Error('No organizations found. Please create an organization first at https://app.supabase.com/account/organizations');
      }
    } catch (error) {
      console.error('❌ Error parsing organizations:', error.message);
      console.error('Raw output:', orgsOutput);
      process.exit(1);
    }

    console.log('\nAvailable organizations:');
    orgs.forEach((org, index) => {
      console.log(`${index + 1}. ${org.name} (ID: ${org.id})`);
    });

    const readline = (await import('readline')).createInterface({
      input: process.stdin,
      output: process.stdout
    });

    // Helper function to ask for user input
    const question = (query) => new Promise(resolve => readline.question(query, resolve));

    // Get organization selection
    let orgIndex = -1;
    while (orgIndex < 0 || orgIndex >= orgs.length) {
      const answer = await question(`\nSelect an organization (1-${orgs.length}): `);
      orgIndex = parseInt(answer, 10) - 1;
      if (isNaN(orgIndex) || orgIndex < 0 || orgIndex >= orgs.length) {
        console.log(`Please enter a number between 1 and ${orgs.length}`);
      }
    }

    const selectedOrg = orgs[orgIndex];
    console.log(`\nSelected organization: ${selectedOrg.name} (${selectedOrg.id})`);

    // 5. Create a new project in the selected organization
    console.log('\n🆕 Creating new Supabase project...');
    let newProjectId;
    try {
      const projectName = `duplicate-${timestamp}`;
      // Generate a secure password
      const dbPassword = require('crypto').randomBytes(16).toString('hex');
      
      console.log(`Creating project: ${projectName} in organization ${selectedOrg.name}...`);
      
      const createProjectCmd = `supabase projects create "${projectName}" ` +
        `--org-id ${selectedOrg.id} ` +
        `--db-password "${dbPassword}" ` +
        `--region us-east-1`;
      
      console.log('Running:', createProjectCmd.replace(dbPassword, '***'));
      const output = execSync(createProjectCmd, { encoding: 'utf-8' });
      
      // Extract project ID from output
      const match = output.match(/Created a new project ([a-z0-9-]+)/i);
      if (!match) {
        console.error('Unexpected output from project creation:', output);
        throw new Error('Could not extract project ID from output');
      }
      
      newProjectId = match[1];
      console.log(`✅ New project created with ID: ${newProjectId}`);
    } catch (error) {
      console.error('❌ Error creating new Supabase project:');
      console.error(error.message);
      console.error('\nYou may need to create a new project manually at: https://app.supabase.com/projects');
      process.exit(1);
    }
    
    // 5. Import the backup to the new project
    console.log('🔄 Importing backup to new project...');
    try {
      const importCmd = `supabase db push --db-url postgresql://postgres:your-password-here@db.${newProjectId}.supabase.co:5432/postgres --file ${backupPath}`;
      console.log(`Running: ${importCmd}`);
      execSync(importCmd, { stdio: 'inherit' });
      console.log('✅ Database imported successfully!');
    } catch (error) {
      console.error('❌ Error importing database:');
      console.error(error.message);
      console.error('\nYou may need to import the backup manually through the Supabase dashboard.');
      process.exit(1);
    }
    
    console.log('\n🎉 Database duplication completed successfully!');
    console.log(`🔗 Project URL: https://app.supabase.com/project/${newProjectId}`);
    console.log(`💾 Backup location: ${backupPath}`);
    
  } catch (error) {
    console.error('❌ Error duplicating database:');
    console.error(error);
    process.exit(1);
  }
}

duplicateDatabase();
