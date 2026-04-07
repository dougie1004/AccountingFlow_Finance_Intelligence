import * as XLSX from 'xlsx';

/**
 * Universal Excel Export Utility
 * @param data Array of objects to export
 * @param fileName Desired filename (without extension)
 * @param sheetName Sheet name inside the workbook
 */
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
    try {
        if (!data || data.length === 0) {
            console.warn('No data to export');
            return;
        }

        // 1. Create a worksheet from the JSON data
        const worksheet = XLSX.utils.json_to_sheet(data);

        // 2. Create a new workbook and append the worksheet
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

        // 3. Generate buffer and trigger download
        // In a browser environment, writeFile handles the download trigger
        XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`);
        
    } catch (error) {
        console.error('Excel Export Failed:', error);
        alert('엑셀 파일 생성 중 오류가 발생했습니다.');
    }
};

/**
 * Formats Ledger/Journal data for clean Excel output
 */
export const formatLedgerForExport = (ledger: any[]) => {
    return ledger.map(entry => ({
        'ID': entry.id,
        '날짜': entry.date,
        '적요': entry.description,
        '거래처': entry.vendor || '-',
        '차변계정': entry.debitAccount,
        '대변계정': entry.creditAccount,
        '금액': entry.amount,
        '부가세': entry.vat || 0,
        '유형': entry.type,
        '상태': entry.status,
        '증빙': entry.attachmentUrl ? '있음' : '없음'
    }));
};
