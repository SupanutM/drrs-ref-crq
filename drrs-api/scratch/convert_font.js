const fs = require('fs');
const path = require('path');

const fontPath = path.join(__dirname, '..', 'assets', 'fonts', 'THSarabun.ttf');
const htmlPath = path.join(__dirname, '..', 'src', 'templates', 'email_contract.template.html');

console.log("Reading font:", fontPath);
const font = fs.readFileSync(fontPath);
const base64 = font.toString('base64');

console.log("Reading html:", htmlPath);
let html = fs.readFileSync(htmlPath, 'utf8');

// replace the specific url string
html = html.replace(/url\('\{\{api_url\}\}\/assets\/fonts\/THSarabun\.ttf'\)/g, `url(data:font/truetype;charset=utf-8;base64,${base64})`);

console.log("Writing html...");
fs.writeFileSync(htmlPath, html);
console.log("Done");
