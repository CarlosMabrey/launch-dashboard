const fs = require('fs');
const path = require('path');

const targetPath = 'D:\\Pi\\tools\\dashboard\\server.js';

// Read file as UTF-8, preserve line endings
const content = fs.readFileSync(targetPath, 'utf8');
const lines = content.split(/\r?\n/);

// Find the line with "const saveSnippetsData ="
const startIdx = lines.findIndex(l => l.includes('const saveSnippetsData ='));
if (startIdx === -1) {
  console.error('Could not find "const saveSnippetsData =" line');
  process.exit(1);
}

// Find the end of that function: the "};" line after the try-catch block
let endIdx = startIdx;
while (endIdx < lines.length) {
  if (lines[endIdx].trim() === '};') {
    // Check if next line is blank (or we are at the blank line before // Start)
    if (endIdx + 1 < lines.length && lines[endIdx + 1].trim() === '') {
      break;
    }
  }
  endIdx++;
}

if (endIdx >= lines.length) {
  console.error('Could not find end of saveSnippetsData function');
  process.exit(1);
}

// Insert after that blank line (so at endIdx+2 to preserve the blank line, or endIdx+1 to replace blank)
const insertAt = endIdx + 1;

// The new endpoints to insert
const newCode = [
  '',
  '// Snippet Library API endpoints (used by code-preview app)',
  "app.get('/api/snippets', (req, res) => {",
  '    const snippets = loadSnippets();',
  '    res.json(snippets);',
  '});',
  '',
  "app.post('/api/snippets', (req, res) => {",
  '    const newSnippets = req.body;',
  '    if (!Array.isArray(newSnippets)) {',
  '        return res.status(400).json({ success: false, error: \'Expected an array of snippets\' });',
  '    }',
  '    saveSnippetsData(newSnippets);',
  '    res.json({ success: true, count: newSnippets.length });',
  '});',
  ''
];

// Build new lines array
const newLines = [
  ...lines.slice(0, insertAt),
  ...newCode,
  ...lines.slice(insertAt)
];

// Write back with Windows line endings
fs.writeFileSync(targetPath, newLines.join('\r\n'), 'utf8');
console.log(`✅ Inserted snippet endpoints at line ${insertAt}`);
