import React, { useRef, useState, useEffect } from 'react';
import { Upload, Loader2, FileUp, AlertTriangle } from 'lucide-react';
import { useAccounting } from '../../hooks/useAccounting';
import { invoke } from '@tauri-apps/api/core';
import { ParsedTransaction } from '../../types';
import * as XLSX from 'xlsx';
import { DataMapper } from './DataMapper';

interface FileUploaderProps {
    onTransactionsLoaded: (transactions: ParsedTransaction[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({ onTransactionsLoaded }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [mapperOpen, setMapperOpen] = useState(false);
    const [uploadQueue, setUploadQueue] = useState<{ bytes: number[], name: string, headers: string[], initialMapping: Record<string, string> }[]>([]);
    const [isMappingProgress, setIsMappingProgress] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const { config, refreshQuota } = useAccounting();


    const processFiles = async (files: File[]) => {
        if (files.length === 0) return;

        setIsUploading(true);
        setError(null);
        let allParsed: ParsedTransaction[] = [];
        let structuredQueue: any[] = [];

        try {
            for (const file of files) {
                const arrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                const isStructured = ['.csv', '.xlsx', '.xls', '.tsv'].includes(ext);

                if (isStructured) {
                    try {
                        const fileInfo = await invoke<{ headers: string[], samples: string[][] }>('get_file_headers', {
                            fileBytes: Array.from(bytes),
                            fileName: file.name
                        });
                        const initialMapping = await invoke<Record<string, string>>('suggest_file_mapping', { 
                            headers: fileInfo.headers, 
                            samples: fileInfo.samples 
                        });

                        structuredQueue.push({ bytes: Array.from(bytes), name: file.name, headers: fileInfo.headers, initialMapping });
                        continue; // Process next file in loop
                    } catch (err) {
                        console.warn("Structured parsing failed, falling back to AI:", err);
                    }
                }

                // AI Processing (Unstructured or Fallback)
                const results = await invoke<ParsedTransaction[]>('process_universal_file', {
                    fileBytes: Array.from(bytes),
                    fileName: file.name,
                    tenantId: config.tenantId || "default",
                    tier: config.tier || "Free"
                });

                if (results && results.length > 0) {
                    // ... same image preview and validation logic ...
                    const isImage = ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
                    if (isImage) {
                        const blob = new Blob([bytes], { type: file.type });
                        const attachmentUrl = URL.createObjectURL(blob);
                        results.forEach(tx => {
                            (tx as any).attachmentUrl = attachmentUrl;
                        });
                    }

                    const validResults = results.filter(r => Number(r.amount) > 1);
                    const invalidCount = results.length - validResults.length;

                    if (invalidCount > 0) {
                        console.warn('Invalid transaction data detected and filtered:', results.find(r => Number(r.amount) <= 1));
                    }

                    if (validResults.length > 0) {
                        const resultsWithOriginal = validResults.map(r => ({
                            ...r,
                            originalAmount: r.amount
                        }));
                        allParsed = [...allParsed, ...resultsWithOriginal];
                    }
                }
            }

            if (allParsed.length > 0) {
                onTransactionsLoaded(allParsed);
                refreshQuota();
            }

            if (structuredQueue.length > 0) {
                setUploadQueue(prev => [...prev, ...structuredQueue]);
                setMapperOpen(true);
            }
        } catch (err: any) {
            console.error('Upload Error:', err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleMappingConfirm = async (mapping: Record<string, string>) => {
        if (uploadQueue.length === 0) return;
        const currentFile = uploadQueue[0];
        setIsMappingProgress(true);
        try {
            const results = await invoke<ParsedTransaction[]>('process_file_with_mapping', {
                fileBytes: currentFile.bytes,
                fileName: currentFile.name,
                mapping
            });

            const isDoubleEntryMapped = !!(mapping['debit_account'] && mapping['credit_account']);

            const finalResults = results.map(r => ({
                ...r,
                isJournalMode: r.isJournalMode || isDoubleEntryMapped,
                isUserConfirmed: true,
                originalAmount: r.amount
            }));

            onTransactionsLoaded(finalResults);
            
            // Move to next file in queue
            const nextQueue = uploadQueue.slice(1);
            setUploadQueue(nextQueue);
            if (nextQueue.length === 0) {
                setMapperOpen(false);
            }
        } catch (err: any) {
            console.error("Mapping Error:", err);
            setError(err instanceof Error ? err.message : String(err));
        } finally {
            setIsMappingProgress(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        await processFiles(files);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const files = Array.from(e.dataTransfer.files);
        await processFiles(files);
    };

    return (
        <div className="relative">
            {mapperOpen && uploadQueue.length > 0 && (
                <DataMapper
                    fileName={uploadQueue[0].name}
                    headers={uploadQueue[0].headers}
                    initialMapping={uploadQueue[0].initialMapping}
                    onConfirm={handleMappingConfirm}
                    onCancel={() => {
                        const nextQueue = uploadQueue.slice(1);
                        setUploadQueue(nextQueue);
                        if (nextQueue.length === 0) {
                            setMapperOpen(false);
                        }
                    }}
                    error={error}
                    isProcessing={isMappingProgress}
                />
            )}

            <div
                className={`professional-card p-12 flex flex-col items-center justify-center text-center gap-4 transition-all ${isUploading ? 'opacity-50 pointer-events-none' :
                    isDragging ? 'border-indigo-500 bg-indigo-500/10 scale-105' :
                        'hover:border-indigo-500/50 cursor-pointer'
                    }`}
                onClick={() => !isUploading && fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    accept=".xlsx,.xls,.csv,.pdf,.jpg,.jpeg,.png,.docx,.pptx,.hwp"
                    multiple
                    onChange={handleFileUpload}
                />

                {isUploading ? (
                    <div className="bg-indigo-500/10 p-5 rounded-3xl text-indigo-400 animate-pulse">
                        <Loader2 size={40} className="animate-spin" />
                    </div>
                ) : (
                    <div className="bg-indigo-500/10 p-5 rounded-3xl text-indigo-400">
                        <FileUp size={40} />
                    </div>
                )}

                <div>
                    <h3 className="text-xl font-black text-white tracking-tight">
                        {isDragging ? '파일을 여기에 놓으세요!' : '통합 데이터 입력 엔진 (Universal Ingestion)'}
                    </h3>
                    <p className="text-slate-400 font-bold mt-1">
                        {isDragging ? '드래그 앤 드롭으로 파일 업로드' : 'CSV, Excel, 영수증 사진, PDF 등 모든 형식을 AI가 자동으로 분석합니다.'}
                    </p>
                </div>

                {error && (
                    <div className="mt-4 flex items-center gap-2 text-rose-400 bg-rose-400/10 px-4 py-2 rounded-xl text-xs font-bold border border-rose-400/20">
                        <AlertTriangle size={14} />
                        {error}
                    </div>
                )}
            </div>
        </div>
    );
};
