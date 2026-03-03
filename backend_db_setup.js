const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

try {
    console.log('Installing @prisma/client and sqlite3...');
    execSync('npm install @prisma/client sqlite3', { cwd: backendDir, stdio: 'inherit' });
    console.log('Syncing database schema...');
    execSync('npx prisma db push', { cwd: backendDir, stdio: 'inherit' });
    console.log('Database setup complete.');
} catch (error) {
    console.error('Database setup failed:', error.message);
}
