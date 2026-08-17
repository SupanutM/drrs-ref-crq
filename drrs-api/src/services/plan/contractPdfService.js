const puppeteer = require('puppeteer');
const { PDFDocument } = require('pdf-lib-plus-encrypt');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

const generateContractPdf = async (customerInfo, selectedAccounts) => {
    // 1. Render HTML Template
    const templatePath = path.join(__dirname, '../../templates/planSummary.html');

    // In case no accounts are selected, ensure it's an array
    const accounts = Array.isArray(selectedAccounts) ? selectedAccounts : [];

    const htmlContent = await ejs.renderFile(templatePath, {
        customerInfo: customerInfo || {},
        selectedAccounts: accounts
    });

    // 2. Generate PDF from HTML using Puppeteer
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();

    // Set HTML and wait until network is idle so fonts load
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Generate PDF as Buffer (A4 size)
    const summaryPdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' }
    });

    await browser.close();

    // 3. Merge with contract.pdf
    const contractPdfPath = path.join(__dirname, '../../../assets/contract.pdf');

    // Check if contract exists, if not just return the summary
    if (!fs.existsSync(contractPdfPath)) {
        console.warn('contract.pdf not found in assets, returning only summary');
        return summaryPdfBuffer;
    }

    const contractPdfBytes = fs.readFileSync(contractPdfPath);

    const pdfDoc1 = await PDFDocument.load(summaryPdfBuffer);
    const pdfDoc2 = await PDFDocument.load(contractPdfBytes);

    const mergedPdf = await PDFDocument.create();

    // Copy pages from first document
    const copiedPages1 = await mergedPdf.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
    copiedPages1.forEach((page) => {
        mergedPdf.addPage(page);
    });

    // Copy pages from second document
    const copiedPages2 = await mergedPdf.copyPages(pdfDoc2, pdfDoc2.getPageIndices());
    copiedPages2.forEach((page) => {
        mergedPdf.addPage(page);
    });

    // Encrypt the merged PDF using the birthday as password (format DDMMYYYY)
    let pwd = customerInfo?.birthday || '';
    if (pwd && pwd.length === 8) {
        // Assume YYYYMMDD from DB, convert to DDMMYYYY
        const yyyy = pwd.substring(0, 4);
        const mm = pwd.substring(4, 6);
        const dd = pwd.substring(6, 8);
        pwd = `${dd}${mm}${yyyy}`;
    }

    if (pwd) {
        mergedPdf.encrypt({
            userPassword: pwd,
            ownerPassword: process.env.PDF_OWNER_PASSWORD || 'GSB_SECRET_KEY_DRRS',
            permissions: {
                printing: 'highResolution',
                modifying: false,
                copying: false,
                annotating: false,
                fillingForms: false,
                contentAccessibility: true,
                documentAssembly: false
            }
        });
    }

    // Save the merged PDF to a Buffer
    const encryptedBytes = await mergedPdf.save({ useObjectStreams: false });
    return Buffer.from(encryptedBytes);
};

const previewContractHtml = async (customerInfo, selectedAccounts) => {
    const templatePath = path.join(__dirname, '../../templates/planSummary.html');
    const accounts = Array.isArray(selectedAccounts) ? selectedAccounts : [];

    const htmlContent = await ejs.renderFile(templatePath, {
        customerInfo: customerInfo || {},
        selectedAccounts: accounts
    });

    return htmlContent;
};

const savePdfToDisk = (pdfBuffer, filename) => {
    const env = require('../../config/env');
    const savePath = env.contractSavePath || path.join(__dirname, '../../../assets/contracts');
    const resolvedPath = path.resolve(savePath);

    // Create directory if not exists
    if (!fs.existsSync(resolvedPath)) {
        fs.mkdirSync(resolvedPath, { recursive: true });
    }

    const filePath = path.join(resolvedPath, filename);
    fs.writeFileSync(filePath, pdfBuffer);
    return filePath;
};

module.exports = {
    generateContractPdf,
    previewContractHtml,
    savePdfToDisk
};
