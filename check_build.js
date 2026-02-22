const { execSync } = require('child_process');
try {
    const result = execSync('npx next build', { encoding: 'utf8', stdio: 'pipe' });
    console.log('BUILD SUCCESS!!!\n' + result);
} catch (error) {
    console.log('BUILD ERROR!!!\n' + error.stdout + '\n' + error.stderr);
}
