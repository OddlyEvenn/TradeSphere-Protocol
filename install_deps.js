const { execSync } = require('child_process');

try {
    console.log('Installing @nomicfoundation/hardhat-toolbox...');
    execSync('npm install --save-dev @nomicfoundation/hardhat-toolbox', { stdio: 'inherit' });
    console.log('Installing @openzeppelin/contracts...');
    execSync('npm install --save-dev @openzeppelin/contracts', { stdio: 'inherit' });
    console.log('Installing dotenv...');
    execSync('npm install --save-dev dotenv', { stdio: 'inherit' });
    console.log('All dependencies installed successfully.');
} catch (error) {
    console.error('Installation failed:', error.message);
    process.exit(1);
}
