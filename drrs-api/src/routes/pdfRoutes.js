const express = require('express');
const router = express.Router();
const downloadConditionPdfController = require('../controllers/condition/downloadConditionPdfController');
const downloadAndEmailContractPdfController = require('../controllers/condition/downloadAndEmailContractPdfController');
const previewContractHtmlController = require('../controllers/condition/previewContractHtmlController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');
const { authMiddleware } = require('../middleware/authMiddleware');

router.post('/generate-pdf', authMiddleware, systemLogMiddleware('GEN_CONTRACT', 'pdfController'), downloadConditionPdfController.generatePdfController);
router.post('/generate-contract', authMiddleware, downloadAndEmailContractPdfController.generateContractController);
router.post('/preview-contract-html', authMiddleware, previewContractHtmlController.previewContractHtmlController);

module.exports = router;