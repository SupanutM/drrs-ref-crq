const express = require('express');
const router = express.Router();
const controller = require('../controllers/condition/pdfController');
const contractPdfController = require('../controllers/plan/contractPdfController');
const { systemLogMiddleware } = require('../utils/systemLogMiddleware');

router.post('/generate-pdf', systemLogMiddleware('gen-template', 'pdfController'), controller.generatePdfController);
router.post('/generate-contract', contractPdfController.generateContractController);
router.post('/preview-contract-html', contractPdfController.previewContractHtmlController);

module.exports = router;