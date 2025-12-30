const fs = require('fs');
const path = require('path');

const filesToCopy = [
  'index.html',
  'style.css',
  'app.js',
  'logo.png',
  'bcv-logo.png',
  'manifest.json',
  'sw.js'
];

const targetDir = path.join(__dirname, 'www');

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir);
}

filesToCopy.forEach(file => {
  const src = path.join(__dirname, file);
  const dest = path.join(targetDir, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dest);
    console.log(`Copied ${file} to www/`);
  } else {
    console.warn(`Warning: ${file} not found.`);
  }
});

console.log('Build complete!');
