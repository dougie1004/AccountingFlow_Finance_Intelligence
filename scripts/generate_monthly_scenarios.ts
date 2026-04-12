
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';
import { SCENARIO_CONFIGS } from '../src/core/simulation/scenarioConfigs';
import { generateMultiYearSimulation } from '../src/core/simulation/journalGenerator';

// Using Absolute Path to avoid any ambiguity on Windows
const BASE_PATH = 'C:/Projects/AccountingFlow/exports/monthly_ledger_excel';

function exportLedgerToMonthlyExcel(ledger: any[], scenarioName: string) {
    const scenarioDir = path.join(BASE_PATH, scenarioName);
    
    // [FORCE REFRESH] Delete and recreate to ensure no stale data
    if (fs.existsSync(scenarioDir)) {
        console.log(`- Cleaning up existing directory: ${scenarioDir}`);
        fs.rmSync(scenarioDir, { recursive: true, force: true });
    }
    
    fs.mkdirSync(scenarioDir, { recursive: true });

    const grouped = ledger.reduce((acc: any, entry: any) => {
        const month = entry.date.substring(0, 7);
        if (!acc[month]) acc[month] = [];
        acc[month].push(entry);
        return acc;
    }, {});

    Object.keys(grouped).forEach(month => {
        const monthData = grouped[month];
        const formatted = monthData.map((e: any) => ({
            'ID': e.id,
            '날짜': e.date,
            '적요': e.description,
            '거래처': e.vendor || '-',
            '차변계정': e.debitAccount,
            '차변ID': e.debitAccountId || '',
            '대변계정': e.creditAccount,
            '대변ID': e.creditAccountId || '',
            '금액': e.amount,
            '부가세': e.vat || 0,
            '유형': e.type,
            '상태': e.status
        }));

        const worksheet = XLSX.utils.json_to_sheet(formatted);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Ledger');
        
        const filePath = path.join(scenarioDir, `ledger_${month}.xlsx`);
        try {
            XLSX.writeFile(workbook, filePath);
            process.stdout.write('.'); // Progress indicator
        } catch (e) {
            console.error(`\n[ERROR] Failed to write ${filePath}:`, e);
        }
    });
    console.log(`\n- [${scenarioName}] Exported successfully.`);
}

async function run() {
    console.log('🚀 Strategic Scenario Re-export: FORCED REFRESH MODE');
    console.log(`Target: ${BASE_PATH}\n`);
    
    const years = [2026, 2027, 2028];

    for (const [key, config] of Object.entries(SCENARIO_CONFIGS)) {
        console.log(`▶ Processing: ${key}`);
        try {
            const result = generateMultiYearSimulation(years, config);
            exportLedgerToMonthlyExcel(result.ledger, key);
        } catch (err) {
            console.error(`[CRITICAL ERROR] Scenario ${key} failed:`, err);
        }
    }
    
    console.log('\n✨ ALL FILES SYNCHRONIZED TO CURRENT SYSTEM (APRIL 11)');
}

run();
