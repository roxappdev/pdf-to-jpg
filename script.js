/* ============================================
   PDF to JPG Converter - Main Script
   ============================================ */

'use strict';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';

// DOM Elements
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');
const loadingState = document.getElementById('loadingState');
const progressFill = document.getElementById('progressFill');
const results = document.getElementById('results');
const resultsGrid = document.getElementById('resultsGrid');
const errorState = document.getElementById('errorState');
const errorMessage = document.getElementById('errorMessage');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const convertAnotherBtn = document.getElementById('convertAnotherBtn');
const retryBtn = document.getElementById('retryBtn');

// State
let convertedImages = [];
let currentFile = null;

// ============================================
// Event Listeners
// ============================================

// Upload area click
uploadArea.addEventListener('click', () => {
    fileInput.click();
});

// File input change
fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        processPDF(file);
    }
});

// Drag and drop events
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.add('drag-over');
});

uploadArea.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    uploadArea.classList.remove('drag-over');

    const files = e.dataTransfer.files;
    if (files.length > 0) {
        const file = files[0];
        if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
            processPDF(file);
        } else {
            showError('Please upload a valid PDF file.');
        }
    }
});

// Convert another button
convertAnotherBtn.addEventListener('click', resetConverter);

// Retry button
retryBtn.addEventListener('click', resetConverter);

// Download all as ZIP
downloadAllBtn.addEventListener('click', downloadAllAsZip);

// Header scroll effect
window.addEventListener('scroll', () => {
    const header = document.querySelector('.header');
    if (window.scrollY > 10) {
        header.classList.add('scrolled');
    } else {
        header.classList.remove('scrolled');
    }
});

// FAQ accordion
document.querySelectorAll('.faq-question').forEach(button => {
    button.addEventListener('click', () => {
        const item = button.parentElement;
        const isActive = item.classList.contains('active');

        // Close all FAQ items
        document.querySelectorAll('.faq-item').forEach(faq => {
            faq.classList.remove('active');
        });

        // Toggle current item
        if (!isActive) {
            item.classList.add('active');
        }
    });
});

// ============================================
// PDF Processing
// ============================================

/**
 * Process a PDF file and convert its pages to JPG images
 * @param {File} file - The PDF file to process
 */
async function processPDF(file) {
    // Validate file
    if (!file || file.type !== 'application/pdf') {
        showError('Please upload a valid PDF file.');
        return;
    }

    // Check file size (50 MB limit)
    const maxSize = 50 * 1024 * 1024; // 50 MB
    if (file.size > maxSize) {
        showError('File size exceeds the 50 MB limit. Please upload a smaller PDF.');
        return;
    }

    currentFile = file;
    convertedImages = [];

    // Show loading state
    showLoading();
    updateProgress(10);

    try {
        // Read the file as ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        updateProgress(20);

        // Load the PDF document
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        updateProgress(30);

        const totalPages = pdf.numPages;
        const scale = 2.0; // 2x scale for high quality (approximately 300 DPI)

        // Process each page
        for (let i = 1; i <= totalPages; i++) {
            try {
                // Get the page
                const page = await pdf.getPage(i);
                updateProgress(30 + ((i - 1) / totalPages) * 50);

                // Set viewport at high resolution
                const viewport = page.getViewport({ scale: scale });

                // Create canvas
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = viewport.width;
                canvas.height = viewport.height;

                // Render the page to canvas
                const renderContext = {
                    canvasContext: context,
                    viewport: viewport,
                    background: 'white'
                };

                await page.render(renderContext).promise;

                // Convert canvas to JPG blob
                const blob = await new Promise(resolve => {
                    canvas.toBlob(resolve, 'image/jpeg', 0.92);
                });

                // Create filename
                const baseName = file.name.replace(/\.pdf$/i, '');
                const fileName = `${baseName}_page_${i}.jpg`;

                // Create object URL for preview
                const url = URL.createObjectURL(blob);

                convertedImages.push({
                    blob: blob,
                    url: url,
                    name: fileName,
                    page: i,
                    size: blob.size
                });

                // Clean up canvas
                canvas.width = 0;
                canvas.height = 0;

            } catch (pageError) {
                console.error(`Error processing page ${i}:`, pageError);
                // Continue with other pages
            }
        }

        updateProgress(90);

        if (convertedImages.length === 0) {
            showError('Could not extract any pages from the PDF. The file may be empty or corrupted.');
            return;
        }

        // Show results
        updateProgress(100);
        setTimeout(() => {
            showResults();
        }, 300);

    } catch (error) {
        console.error('PDF processing error:', error);
        showError(
            'Failed to process the PDF file. Please make sure the file is not corrupted ' +
            'and try again. If the problem persists, try a different PDF.'
        );
    }
}

// ============================================
// UI State Management
// ============================================

/**
 * Show the loading state
 */
function showLoading() {
    uploadArea.style.display = 'none';
    loadingState.style.display = 'block';
    results.style.display = 'none';
    errorState.style.display = 'none';
    updateProgress(0);
}

/**
 * Update the progress bar
 * @param {number} percent - Progress percentage (0-100)
 */
function updateProgress(percent) {
    progressFill.style.width = `${Math.min(100, Math.max(0, percent))}%`;
}

/**
 * Show the results
 */
function showResults() {
    loadingState.style.display = 'none';
    results.style.display = 'block';
    errorState.style.display = 'none';

    // Clear previous results
    resultsGrid.innerHTML = '';

    // Add each image to the grid
    convertedImages.forEach((image, index) => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.style.animationDelay = `${index * 0.05}s`;

        // Format file size
        const sizeStr = formatFileSize(image.size);

        item.innerHTML = `
            <img src="${image.url}" alt="${image.name}" loading="lazy">
            <div class="result-item-info">
                <span class="result-item-name" title="${image.name}">${image.name}</span>
                <button class="btn-icon" onclick="downloadImage(${index})" title="Download ${image.name}">
                    <i class="fas fa-download"></i>
                </button>
            </div>
        `;

        resultsGrid.appendChild(item);
    });

    // Update download all button text
    const totalSize = convertedImages.reduce((sum, img) => sum + img.size, 0);
    downloadAllBtn.innerHTML = `
        <i class="fas fa-download"></i>
        Download All (${convertedImages.length} images, ${formatFileSize(totalSize)})
    `;
}

/**
 * Show an error message
 * @param {string} message - Error message to display
 */
function showError(message) {
    uploadArea.style.display = 'none';
    loadingState.style.display = 'none';
    results.style.display = 'none';
    errorState.style.display = 'block';
    errorMessage.textContent = message;
}

/**
 * Reset the converter to its initial state
 */
function resetConverter() {
    // Clean up object URLs
    convertedImages.forEach(image => {
        URL.revokeObjectURL(image.url);
    });
    convertedImages = [];
    currentFile = null;

    // Reset UI
    uploadArea.style.display = 'block';
    loadingState.style.display = 'none';
    results.style.display = 'none';
    errorState.style.display = 'none';
    fileInput.value = '';
    updateProgress(0);
}

// ============================================
// Download Functions
// ============================================

/**
 * Download a single image
 * @param {number} index - Index of the image in convertedImages array
 */
function downloadImage(index) {
    const image = convertedImages[index];
    if (!image) return;

    const blob = new Blob([image.blob], { type: 'image/jpeg' });
    saveAs(blob, image.name);
}

/**
 * Download all images as a ZIP file
 */
async function downloadAllAsZip() {
    if (convertedImages.length === 0) return;

    // Show loading state on button
    const originalText = downloadAllBtn.innerHTML;
    downloadAllBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating ZIP...';
    downloadAllBtn.disabled = true;

    try {
        const zip = new JSZip();

        // Add each image to the ZIP
        for (const image of convertedImages) {
            zip.file(image.name, image.blob);
        }

        // Generate ZIP file
        const zipBlob = await zip.generateAsync({
            type: 'blob',
            compression: 'DEFLATE',
            compressionOptions: {
                level: 6
            }
        });

        // Create filename for ZIP
        const baseName = currentFile
            ? currentFile.name.replace(/\.pdf$/i, '')
            : 'pdf_pages';
        const zipName = `${baseName}_images.zip`;

        // Download ZIP
        saveAs(zipBlob, zipName);

    } catch (error) {
        console.error('ZIP creation error:', error);
        showError('Failed to create ZIP file. Please try downloading images individually.');
    } finally {
        // Restore button
        downloadAllBtn.innerHTML = originalText;
        downloadAllBtn.disabled = false;
    }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Format file size in human-readable format
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const size = (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0);
    return `${size} ${units[i]}`;
}

// ============================================
// Keyboard Shortcuts
// ============================================

// Allow pressing Escape to reset
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && results.style.display === 'block') {
        resetConverter();
    }
});

// ============================================
// Initialization
// ============================================

console.log('PDF to JPG Converter initialized');
console.log('Drop a PDF file to convert its pages to JPG images');