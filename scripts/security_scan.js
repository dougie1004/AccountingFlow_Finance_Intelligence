
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const SCAN_PATTERNS = [
    /AIzaSy[A-Za-z0-9-_]{33}/, // Google API Key
    /sk-[A-Za-z0-9]{48}/,      // OpenAI Key (example)
    /"apiKey":\s*".*"/i,
    /"api_key":\s*".*"/i,
    /const\s+apiKey\s*=\s*'.*'/i,
    /const\s+apiKey\s*=\s*".*"/i
];

const IGNORE_DIRS = ['node_modules', '.git', 'dist', 'target', 'target_v3_final', 'temp_scripts_backup'];
const IGNORE_FILES = ['.env', '.env.demo', 'scripts/security_scan.js'];

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    let issues = [];

    for (const file of files) {
        const fullPath = path.join(dir, file);
        const relativePath = path.relative(process.cwd(), fullPath);

        if (IGNORE_DIRS.some(d => relativePath.startsWith(d))) continue;
        if (IGNORE_FILES.some(f => relativePath === f)) continue;

        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
            issues = issues.concat(scanDir(fullPath));
        } else if (stat.size < 1024 * 1024 * 5) { // Only scan files smaller than 5MB
            const content = fs.readFileSync(fullPath, 'utf8');
            SCAN_PATTERNS.forEach(pattern => {
                if (pattern.test(content)) {
                    issues.push(`🚨 [SECURITY VIOLATION] Potential Leak in: ${relativePath}`);
                }
            });
        }
    }
    return issues;
}

console.log("🔍 Running self-monitoring security scan...");
const foundIssues = scanDir(process.cwd());

if (foundIssues.length > 0) {
    console.error("\n❌ DISASTER PREVENTED: Sensitive information found!");
    foundIssues.forEach(m => console.error(m));
    process.exit(1);
} else {
    console.log("\n✅ CLEAN: No sensitive keys detected. Project is safe to proceed.");
    process.exit(0);
}
