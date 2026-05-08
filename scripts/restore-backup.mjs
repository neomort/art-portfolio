import pg from 'pg';
import fs from 'fs';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const DB_CONFIG = {
  user: 'postgres',
  host: 'db.wfeyycukkiekmwychjri.supabase.co',
  database: 'postgres',
  password: 'zv8Y6VfqlPijwNcK',
  port: 5432,
  ssl: {
    rejectUnauthorized: false
  }
};

async function listBackups() {
  try {
    const files = fs.readdirSync('backups')
      .filter(file => file.endsWith('.sql'))
      .sort()
      .reverse();
    
    console.log('\nAvailable backups:');
    files.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });
    
    return files;
  } catch (error) {
    console.error('Error listing backups:', error.message);
    process.exit(1);
  }
}

async function verifyRestore(client) {
  console.log('\n🔍 Verifying restore...');
  
  try {
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    if (tablesRes.rows.length === 0) {
      console.log('⚠️  No tables found in the database');
      return;
    }

    console.log('\n📊 Table row counts:');
    let hasEmptyTables = false;
    
    for (const { table_name } of tablesRes.rows) {
      try {
        const countRes = await client.query(`SELECT COUNT(*) FROM "${table_name}"`);
        const count = parseInt(countRes.rows[0].count);
        console.log(`- ${table_name}: ${count.toLocaleString()} rows`);
        
        if (count === 0) {
          hasEmptyTables = true;
        }
      } catch (err) {
        console.error(`  Error counting rows in ${table_name}:`, err.message);
      }
    }
    
    if (hasEmptyTables) {
      console.log('\n⚠️  Some tables are empty. The backup might not have contained data or there was an issue during restore.');
    }
  } catch (error) {
    console.error('Error during verification:', error.message);
  }
}

async function restoreBackup(filename) {
  const client = new Client(DB_CONFIG);
  let successCount = 0;
  let errorCount = 0;
  let lastError = null;

  try {
    console.log(`\n🔌 Connecting to database...`);
    await client.connect();
    console.log('✅ Connected to database');

    console.log(`\n📥 Reading backup file: ${filename}`);
    const sql = fs.readFileSync(`backups/${filename}`, 'utf8');
    
    console.log('🚀 Starting restore... (this may take a while)');
    const statements = sql.split(';').filter(statement => statement.trim() !== '');
    
    for (const [index, statement] of statements.entries()) {
      const currentStatement = statement.trim();
      if (!currentStatement || currentStatement.startsWith('--')) {
        continue;
      }

      // Create a new client for each statement to avoid transaction issues
      const statementClient = new Client(DB_CONFIG);
      try {
        await statementClient.connect();
        
        // Wrap each statement in its own transaction
        await statementClient.query('BEGIN');
        
        try {
          // Skip ALTER TYPE OWNER statements as they're not critical
          if (currentStatement.includes('ALTER TYPE') && currentStatement.includes('OWNER TO')) {
            console.log(`\nℹ️  Skipping: ${currentStatement.split('\n')[0].substring(0, 100)}...`);
            continue;
          }

          // Skip CREATE EXTENSION statements
          if (currentStatement.startsWith('CREATE EXTENSION')) {
            console.log(`\nℹ️  Skipping: ${currentStatement.split('\n')[0]}...`);
            continue;
          }

          // Skip SET statements
          if (currentStatement.startsWith('SET ')) {
            continue;
          }

          await statementClient.query(currentStatement);
          await statementClient.query('COMMIT');
          successCount++;
        } catch (error) {
          await statementClient.query('ROLLBACK');
          throw error; // This will be caught by the outer try-catch
        }
        
        process.stdout.write(`\r🔄 Processed ${index + 1}/${statements.length} statements (${successCount} successful, ${errorCount} failed)...`);
      } catch (error) {
        errorCount++;
        lastError = error;
        
        // Log non-critical errors but continue
        if (error.message.includes('already exists') || 
            error.message.includes('does not exist') ||
            error.message.includes('will be created implicitly')) {
          console.log(`\nℹ️  ${error.message.split('\n')[0]}`);
        } else {
          console.error(`\n⚠️  Error in statement ${index + 1}:`, error.message.split('\n')[0]);
          console.error('Statement:', currentStatement.substring(0, 200) + '...');
        }
      } finally {
        if (statementClient) {
          await statementClient.end().catch(console.error);
        }
      }
    }

    console.log(`\n\n✅ Restore completed! ${successCount} statements executed successfully, ${errorCount} failed.`);
    
    if (lastError) {
      console.log('\n⚠️  Some statements failed, but the restore continued. The database might be in a partially restored state.');
    }
    
    // Final verification
    console.log('\n🔍 Verifying restore...');
    await verifyRestore(client);
    
  } catch (error) {
    console.error('\n❌ Fatal error during restore:');
    console.error(error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

async function main() {
  try {
    const backups = await listBackups();
    
    if (backups.length === 0) {
      console.log('No backup files found in the backups directory.');
      process.exit(0);
    }
    
    rl.question('\nEnter the number of the backup to restore (or q to quit): ', async (answer) => {
      if (answer.toLowerCase() === 'q') {
        console.log('Operation cancelled.');
        rl.close();
        return;
      }
      
      const index = parseInt(answer) - 1;
      if (isNaN(index) || index < 0 || index >= backups.length) {
        console.log('Invalid selection. Please try again.');
        rl.close();
        return main();
      }
      
      const selectedBackup = backups[index];
      console.log(`\nYou selected: ${selectedBackup}`);
      
      rl.question('Are you sure you want to restore this backup? (y/n) ', async (confirm) => {
        if (confirm.toLowerCase() === 'y') {
          await restoreBackup(selectedBackup);
        } else {
          console.log('Restore cancelled.');
        }
        rl.close();
      });
    });
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Start the script
main().catch(console.error);