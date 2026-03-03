const { execSync } = require('child_process');
const path = require('path');

const backendDir = path.join(__dirname, 'backend');

try {
    console.log('Installing Backend dependencies...');
    execSync('npm install express prisma @prisma/client cookie-parser jsonwebtoken redis dotenv axios', { cwd: backendDir, stdio: 'inherit' });
    console.log('Installing Backend dev dependencies...');
    execSync('npm install --save-dev typescript @types/express @types/cookie-parser @types/jsonwebtoken @types/node ts-node nodemon @types/node', { cwd: backendDir, stdio: 'inherit' });
    console.log('Backend setup complete.');
} catch (error) {
    console.error('Backend installation failed:', error.message);
}
