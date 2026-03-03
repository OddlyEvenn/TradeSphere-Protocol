const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const frontendDir = path.join(__dirname, 'frontend');

try {
    if (!fs.existsSync(frontendDir)) {
        fs.mkdirSync(frontendDir);
    }
    console.log('Initializing Frontend with Vite...');
    execSync('npx create-vite@latest ./ --template react-ts -y', { cwd: frontendDir, stdio: 'inherit' });
    console.log('Installing Frontend dependencies...');
    execSync('npm install tailwindcss postcss autoprefixer axios ethers lucide-react react-router-dom', { cwd: frontendDir, stdio: 'inherit' });
    console.log('Initializing Tailwind...');
    execSync('npx tailwindcss init -p', { cwd: frontendDir, stdio: 'inherit' });
    console.log('Frontend setup complete.');
} catch (error) {
    console.error('Frontend setup failed:', error.message);
}
