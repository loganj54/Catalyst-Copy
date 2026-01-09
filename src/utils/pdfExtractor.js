// ============================================================================
// PDF TEXT EXTRACTION UTILITY
// ============================================================================
// Uses PDF.js to extract text from PDFs entirely in the browser
// No server resources needed - works with any file size
// ============================================================================

import * as pdfjsLib from 'pdfjs-dist';

// Import the worker using a standard URL that works in Vite because we copied the file to public/
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

/**
 * Extract all text content from a PDF file
 * @param {File} file - The PDF file to extract text from
 * @param {function} onProgress - Optional progress callback (pageNumber, totalPages)
 * @returns {Promise<{text: string, pageCount: number, extractionTime: number}>}
 */
export async function extractTextFromPdf(file, onProgress = null) {
    const startTime = Date.now();

    console.log(`[PDF Extract] Starting extraction from: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Load the PDF
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPages = pdf.numPages;

    console.log(`[PDF Extract] PDF loaded: ${numPages} pages`);

    // Extract text from all pages
    const textParts = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();

            // Combine text items, preserving basic structure
            const pageText = textContent.items
                .map(item => item.str)
                .join(' ');

            if (pageText.trim()) {
                textParts.push(`--- Page ${pageNum} ---\n${pageText}`);
            }

            if (onProgress) {
                onProgress(pageNum, numPages);
            }

        } catch (pageError) {
            console.warn(`[PDF Extract] Error on page ${pageNum}:`, pageError);
            textParts.push(`--- Page ${pageNum} ---\n[Error extracting text]`);
        }
    }

    const fullText = textParts.join('\n\n');
    const extractionTime = Date.now() - startTime;

    console.log(`[PDF Extract] Complete: ${fullText.length} characters in ${extractionTime}ms`);

    return {
        text: fullText,
        pageCount: numPages,
        extractionTime,
    };
}

/**
 * Check if a file is a PDF
 * @param {File} file 
 * @returns {boolean}
 */
export function isPdfFile(file) {
    return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/**
 * Check if a file is large enough to need client-side processing
 * @param {File} file 
 * @param {number} thresholdMB - Size threshold in MB (default 5MB)
 * @returns {boolean}
 */
export function isLargeFile(file, thresholdMB = 5) {
    return file.size > thresholdMB * 1024 * 1024;
}
