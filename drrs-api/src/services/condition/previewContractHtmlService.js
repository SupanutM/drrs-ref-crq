const ejs = require('ejs');
const path = require('path');
const fs = require('fs');

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
    previewContractHtml,
    savePdfToDisk
};
