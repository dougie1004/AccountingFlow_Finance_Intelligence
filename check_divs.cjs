
const fs = require('fs');
const content = fs.readFileSync('c:\\Projects\\AccountingFlow\\src\\pages\\StrategicCompass.tsx', 'utf8');

let openDivs = 0;
let lineNum = 0;
content.split('\n').forEach(line => {
    lineNum++;
    const opens = (line.match(/<div/g) || []).length;
    const closes = (line.match(/<\/div>/g) || []).length;
    openDivs += opens - closes;
    if (lineNum > 1000 && lineNum < 1890) {
        console.log(`${lineNum}: ${openDivs} (O:${opens}, C:${closes}) | ${line.trim().substring(0, 40)}`);
    }
});
console.log("Final balance:", openDivs);
