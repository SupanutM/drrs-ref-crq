const express = require('express');
const router = express.Router();
const downloadConditionPdfController = require('../controllers/condition/downloadConditionPdfController');
const downloadAndEmailContractPdfController = require('../controllers/condition/downloadAndEmailContractPdfController');
const previewContractHtmlController = require('../controllers/condition/previewContractHtmlController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');
const { checkSystemOpenMiddleware } = require('../middleware/checkSystemOpenMiddleware');

router.post('/generate-pdf', checkSystemOpenMiddleware, authMiddleware, systemLogMiddleware('GEN_CONTRACT', 'pdfController'), downloadConditionPdfController.generatePdfController);
router.post('/generate-contract', checkSystemOpenMiddleware, authMiddleware, downloadAndEmailContractPdfController.generateContractController);
router.post('/preview-contract-html', checkSystemOpenMiddleware, authMiddleware, previewContractHtmlController.previewContractHtmlController);

module.exports = router;