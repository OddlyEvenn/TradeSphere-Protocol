const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const bDir = path.join(__dirname, 'backend');
const fDir = path.join(__dirname, 'frontend');

function cleanAndInstall(dir) {
    console.log(`Cleaning ${dir}...`);
    const nm = path.join(dir, 'node_modules');
    const lock = path.join(dir, 'package-lock.json');
    if (fs.existsSync(nm)) fs.rmSync(nm, { recursive: true, force: true });
    if (fs.existsSync(lock)) fs.unlinkSync(lock);
    
    console.log(`Installing deps for ${dir}...`);
    // Use --save-exact to be VERY sure
    if (dir.includes('frontend')) {
        execSync('npm install --save-exact tailwindcss@3.4.1 postcss@8.4.35 autoprefixer@10.4.18', { cwd: dir, stdio: 'inherit' });
        execSync('npm install', { cwd: dir, stdio: 'inherit' });
    } else {
        execSync('npm install', { cwd: dir, stdio: 'inherit' });
    }
}

try {
    cleanAndInstall(fDir);
    console.log('Setup finished successfully.');
} catch (e) {
    console.error('Setup failed:', e.message);
}
