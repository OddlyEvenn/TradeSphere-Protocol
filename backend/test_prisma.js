const { execSync } = require('child_process');
try {
    console.log('Running prisma generate...');
    const out = execSync('node_modules\\.bin\\prisma.cmd generate --schema=schema.prisma', { stdio: 'pipe' });
    console.log('STDOUT:', out.toString());
} catch (e) {
    console.log('ERROR occurred:');
    if (e.stdout) console.log('STDOUT:', e.stdout.toString());
    if (e.stderr) console.log('STDERR:', e.stderr.toString());
}
