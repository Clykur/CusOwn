const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.next') {
        walk(fullPath, callback);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      callback(fullPath);
    }
  }
}

const appsDir = path.join(process.cwd(), 'apps');

walk(appsDir, (file) => {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes('@/src/icons')) {
    const updated = content.replace(/@\/src\/icons/g, '@cusown/shared/icons');
    fs.writeFileSync(file, updated);
    console.log(`Updated: ${file}`);
  }
});
