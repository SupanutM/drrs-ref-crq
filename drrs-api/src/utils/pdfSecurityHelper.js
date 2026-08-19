const { PDFDocument } = require('pdf-lib-plus-encrypt');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'pdfSecurityHelper' });

/**
 * Encrypts a PDF Buffer using the provided raw password.
 * Formats the raw password to DDMMYYYY if it represents a date of birth.
 * 
 * @param {Buffer} pdfBuffer - The raw unencrypted PDF buffer
 * @param {string} rawPasswordString - The raw password (e.g. from DB birthday)
 * @returns {Promise<Buffer>} - The encrypted PDF buffer
 */
const encryptPdfBuffer = async (pdfBuffer, rawPasswordString) => {
    let formattedPassword = String(rawPasswordString || '').replace(/[^a-zA-Z0-9]/g, '');

    // Format YYYYMMDD to DDMMYYYY
    if (formattedPassword && formattedPassword.length === 8) {
        const yyyy = formattedPassword.substring(0, 4);
        const mm = formattedPassword.substring(4, 6);
        const dd = formattedPassword.substring(6, 8);
        formattedPassword = `${dd}${mm}${yyyy}`;
    }

    if (!formattedPassword) {
        logger.warn('[PDF Security]: No valid password provided, returning unencrypted PDF.');
        return pdfBuffer;
    }

    const ownerPassword = process.env.PDF_OWNER_PASSWORD || 'GSB_SECRET_KEY_DRRS';

    try {
        const pdfDoc = await PDFDocument.load(pdfBuffer);
        
        pdfDoc.encrypt({
            userPassword: formattedPassword,
            ownerPassword: ownerPassword,
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
        
        const encryptedBytes = await pdfDoc.save({ useObjectStreams: false });
        logger.info(`[PDF Security]: PDF encrypted successfully. userPassword set to: ${formattedPassword}`);
        return Buffer.from(encryptedBytes);
    } catch (error) {
        logger.error(`[PDF Security]: Failed to encrypt PDF: ${error.message}`);
        throw error;
    }
};

module.exports = {
    encryptPdfBuffer
};
