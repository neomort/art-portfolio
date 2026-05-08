import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { config } from 'dotenv';
import fs from 'fs';
import readline from 'readline';
import FormData from 'form-data';
import fetch from 'node-fetch';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const envPath = join(__dirname, '..', '.env');

if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Helper function to ask for user input
const question = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => rl.question(query, (ans) => {
    rl.close();
    resolve(ans);
  }));
};

async function main() {
  try {
    console.log('🚀 Starting database restoration to new Supabase account...');

    // 1. Find the latest backup file
    const backupDir = join(process.cwd(), 'backups');
    if (!fs.existsSync(backupDir)) {
      console.error('❌ No backups directory found. Please run the backup script first.');
      process.exit(1);
    }

    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.endsWith('.sql') && file.startsWith('supabase-backup-'))
      .sort()
      .reverse();

    if (backupFiles.length === 0) {
      console.error('❌ No backup files found in the backups directory.');
      process.exit(1);
    }

    // 2. Let user select a backup file
    console.log('\nAvailable backup files:');
    backupFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    let selectedIndex = -1;
    while (selectedIndex < 0 || selectedIndex >= backupFiles.length) {
      const answer = await question(`\nSelect a backup file to restore (1-${backupFiles.length}): `);
      selectedIndex = parseInt(answer, 10) - 1;
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= backupFiles.length) {
        console.log(`Please enter a number between 1 and ${backupFiles.length}`);
      }
    }

    const backupFile = backupFiles[selectedIndex];
    const backupPath = join(backupDir, backupFile);
    console.log(`\nSelected backup: ${backupPath}`);

    // 3. Get Supabase Personal Access Token
    console.log('\n🔑 Please provide your Supabase Personal Access Token:');
    console.log('1. Go to: https://app.supabase.com/account/tokens');
    console.log('2. Click "Generate new token"');
    console.log('3. Give it a name (e.g., "Database Restore")');
    
    const accessToken = await question('\nPaste your token here (it will be hidden): ', { silent: true });
    
    if (!accessToken) {
      console.error('❌ No token provided. Please provide a valid access token.');
      process.exit(1);
    }
    
    console.log('✅ Successfully authenticated with Supabase');
    console.log('✅ Successfully logged in to Supabase');

    // 5. First, get the organization ID
    console.log('\n🔍 Getting organization information...');
    const orgsResponse = await fetch('https://api.supabase.com/v1/organizations', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!orgsResponse.ok) {
      const error = await orgsResponse.json();
      console.error('❌ Failed to get organization information:', error);
      process.exit(1);
    }

    const orgs = await orgsResponse.json();
    if (!orgs || orgs.length === 0) {
      console.error('❌ No organizations found. Please create an organization first at https://app.supabase.com/organizations/new');
      process.exit(1);
    }

    // Use the first organization by default (or let the user choose if multiple)
    const organization = orgs[0];
    console.log(`✅ Using organization: ${organization.name} (${organization.id})`);

    // 6. Create a new project
    console.log('\n🆕 Creating new Supabase project...');
    const projectName = `duplicate-${new Date().toISOString().replace(/[:.]/g, '-')}`;
    const dbPassword = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2).toUpperCase();
    
    const createProjectResponse = await fetch('https://api.supabase.com/v1/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        name: projectName,
        organization_id: organization.id,
        db_pass: dbPassword,
        region: 'us-east-1',
      }),
    });

    if (!createProjectResponse.ok) {
      const error = await createProjectResponse.json();
      console.error('❌ Failed to create project:', error);
      process.exit(1);
    }

    const project = await createProjectResponse.json();
    console.log(`✅ Project created: ${project.name} (${project.id})`);
    console.log('🔄 Project is being prepared. This may take a few minutes...');

    // 6. Wait for project to be ready
    let projectReady = false;
    let attempts = 0;
    const maxAttempts = 30; // 5 minutes max wait

    while (!projectReady && attempts < maxAttempts) {
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.status === 'ACTIVE_HEALTHY') {
          projectReady = true;
          console.log('✅ Project is ready!');
          break;
        }
        console.log(`⏳ Project status: ${status.status} (${attempts * 10}s elapsed)`);
      }
    }

    if (!projectReady) {
      console.error('❌ Timed out waiting for project to be ready. Please check the Supabase dashboard.');
      console.log(`Project URL: https://app.supabase.com/project/${project.id}`);
      process.exit(1);
    }

    // 7. Upload and restore the backup using PITR (Point-in-Time Recovery)
    console.log('\n📤 Uploading and restoring backup file...');
    const form = new FormData();
    form.append('file', fs.createReadStream(backupPath));

    // First, upload the backup file to get a reference
    const uploadResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/database/backups/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('❌ Failed to upload backup file:', error);
      process.exit(1);
    }

    const { id: backupId } = await uploadResponse.json();
    console.log('✅ Backup uploaded successfully!');
    console.log('🔄 Starting database restore...');

    // Then, restore from the uploaded backup
    const restoreResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/restore`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        backup_id: backupId,
        recovery_time_target: new Date().toISOString(),
      }),
    });

    if (!restoreResponse.ok) {
      const error = await restoreResponse.text();
      console.error('❌ Failed to start database restore:', error);
      process.exit(1);
    }

    if (!uploadResponse.ok) {
      const error = await uploadResponse.text();
      console.error('❌ Failed to upload backup:', error);
      process.exit(1);
    }

    console.log('✅ Backup uploaded successfully!');
    console.log('🔄 Restoring database. This may take several minutes...');

    // 8. Wait for restore to complete
    let restoreComplete = false;
    attempts = 0;
    
    while (!restoreComplete && attempts < 60) { // 10 minutes max
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}/database/backups/restore`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (statusResponse.ok) {
        const status = await statusResponse.json();
        if (status.status === 'COMPLETED') {
          restoreComplete = true;
          console.log('✅ Database restore completed successfully!');
          break;
        } else if (status.status === 'FAILED') {
          console.error('❌ Database restore failed:', status.error);
          process.exit(1);
        }
        console.log(`⏳ Restore status: ${status.status} (${attempts * 10}s elapsed)`);
      }
    }

    if (!restoreComplete) {
      console.error('❌ Timed out waiting for restore to complete. Please check the Supabase dashboard.');
    }

    // 9. Get project details
    const projectDetailsResponse = await fetch(`https://api.supabase.com/v1/projects/${project.id}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (projectDetailsResponse.ok) {
      const projectDetails = await projectDetailsResponse.json();
      console.log('\n🎉 Database restoration completed successfully!');
      console.log('\n🔗 Project URL:', `https://app.supabase.com/project/${project.id}`);
      console.log('🌐 API URL:', projectDetails.connectionString.replace('?sslmode=require', ''));
      console.log('🔑 Database password:', project.db_pass);
      console.log('\nYou can now update your application to use the new database by updating your environment variables:');
      console.log(`VITE_SUPABASE_URL=${projectDetails.connectionString.replace('?sslmode=require', '').replace('postgresql://postgres:', 'https://').split('@')[1]}`);
      console.log(`VITE_SUPABASE_ANON_KEY=${project.anon_key}`);
      console.log(`VITE_SUPABASE_SERVICE_KEY=${project.service_key}`);
    } else {
      console.log('\n🎉 Database restoration completed!');
      console.log('\n🔗 Project URL:', `https://app.supabase.com/project/${project.id}`);
      console.log('\nPlease check your Supabase dashboard for connection details.');
    }

  } catch (error) {
    console.error('❌ An error occurred:');
    console.error(error);
    process.exit(1);
  }
}

main();
