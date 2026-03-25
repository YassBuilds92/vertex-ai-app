const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// The original file literally has backslashes before backticks and dollar signs from JSON parsing.
// We want to remove the backslash preceding ` and $.
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

// Write it back
fs.writeFileSync('src/App.tsx', content, 'utf8');
console.log('Fixed escaping in src/App.tsx');
