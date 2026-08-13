const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const { XMLParser } = require('fast-xml-parser');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'pdfController' });

const fontPath = path.join(__dirname, '../../assets/fonts', 'THSarabun.ttf');
const fontBoldPath = path.join(__dirname, '../../assets/fonts', 'THSarabun Bold.ttf');
const xmlTemplatePath = path.join(__dirname, '../model/template/invoice-template.xml');

const generateInvoiceBase64 = (data) => {
    return new Promise(async (resolve, reject) => {
        try {
            const { customerName, invoiceNo, items } = data;
            const xmlTemplate = fs.readFileSync(xmlTemplatePath, 'utf8');

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "",
                entities: { nbsp: ' ' }
            });
            const docStructure = parser.parse(xmlTemplate).document;

            const marginTop = docStructure.marginTop ? parseInt(docStructure.marginTop) : 43;
            const marginBottom = docStructure.marginBottom ? parseInt(docStructure.marginBottom) : 43;
            const marginLeft = docStructure.marginLeft ? parseInt(docStructure.marginLeft) : 85;
            const marginRight = docStructure.marginRight ? parseInt(docStructure.marginRight) : 55;

            const doc = new PDFDocument({
                size: 'A4',
                margins: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight }
            });

            // เก็บ chunk ไว้และ resolve ค่า base64 เมื่อเอกสารสร้างเสร็จ
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => {
                const base64String = Buffer.concat(chunks).toString('base64');
                logger.info(`Stream ended. Base64 generated successfully for Invoice No: ${invoiceNo}`);
                resolve(base64String);
            });
            doc.on('error', (err) => reject(err)); // ดักจับ Error จาก PDFKit

            const elements = Array.isArray(docStructure.element) ? docStructure.element : [docStructure.element];

            for (const el of elements) {
                if (el.tag === 'text') {
                    let textContent = String(el['#text'] || '')
                        .replace(/&nbsp;/g, ' ')
                        .replace(/\s+/g, ' ')
                        .trim();

                    const baseMargin = marginLeft;
                    const indentVal = el.indent ? parseInt(el.indent) : 0;
                    const xPosition = (el.x ? parseInt(el.x) : baseMargin) + indentVal;

                    doc.x = xPosition;
                    const charSpaceValue = el.characterSpacing !== undefined ? parseFloat(el.characterSpacing) : -0.1;
                    const alignment = el.align || 'left'; 
                    const textOptions = { align: alignment, characterSpacing: charSpaceValue };

                    if (alignment === 'center' || alignment === 'justify') {
                        textOptions.width = 595.28 - marginLeft - marginRight;
                    }

                    doc.font(el.type === 'heading' ? fontBoldPath : fontPath)
                        .fontSize(parseInt(el.size) || 16)
                        .text(textContent, textOptions);

                    if (el.spaceAfter) {
                        doc.moveDown(parseFloat(el.spaceAfter) / 12);
                    }
                }
                else if (el.tag === 'spacer') {
                    doc.moveDown(parseFloat(el.lines) || 1);
                }
                else if (el.tag === 'table') {
                    const widths = el.widths ? el.widths.split(',').map(Number) : null;
                    const headers = el.headers?.col ? (Array.isArray(el.headers.col) ? el.headers.col : [el.headers.col]) : [];
                    const rows = (items || []).map(i => [i.desc, String(i.qty), String(i.price)]);

                    await doc.table({ headers, rows }, {
                        columnsSize: widths,
                        prepareHeader: () => doc.font(fontBoldPath).fontSize(16),
                        prepareRow: () => doc.font(fontPath).fontSize(14)
                    });
                }
            }

            doc.end();

        } catch (error) {
            reject(error);
        }
    });
};

module.exports = {
    generateInvoiceBase64
};