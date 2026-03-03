const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const frontendDir = path.join(__dirname, 'frontend');

try {
    console.log('Cleaning up frontend...');
    
    const nodeModules = path.join(frontendDir, 'node_modules');
    const lockFile = path.join(frontendDir, 'package-lock.json');
    
    if (fs.existsSync(nodeModules)) {
        console.log('Removing node_modules...');
        fs.rmSync(nodeModules, { recursive: true, force: true });
    }
    
    if (fs.existsSync(lockFile)) {
        console.log('Removing package-lock.json...');
        fs.unlinkSync(lockFile);
    }

    console.log('Installing Tailwind CSS v3.4.1 and dependencies...');
    // We force install the specific versions
    execSync('npm install tailwindcss@3.4.1 postcss@8.4.35 autoprefixer@10.4.18', { cwd: frontendDir, stdio: 'inherit' });
    execSync('npm install', { cwd: frontendDir, stdio: 'inherit' });
    
    console.log('Frontend setup complete.');
} catch (error) {
    console.error('Frontend setup failed:', error.message);
}
