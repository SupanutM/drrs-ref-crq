const express = require('express');
const router = express.Router();
const downloadConditionPdfController = require('../controllers/condition/downloadConditionPdfController');
const downloadAndEmailContractPdfController = require('../controllers/condition/downloadAndEmailContractPdfController');
const previewContractHtmlController = require('../controllers/condition/previewContractHtmlController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

router.post('/generate-pdf', systemLogMiddleware('gen-template', 'pdfController'), downloadConditionPdfController.generatePdfController);
router.post('/generate-contract', downloadAndEmailContractPdfController.generateContractController);
router.post('/preview-contract-html', previewContractHtmlController.previewContractHtmlController);

module.exports = router;