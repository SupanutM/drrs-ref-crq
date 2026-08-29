const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit-table');
const { XMLParser } = require('fast-xml-parser');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'pdfervice' });

const fontPath = path.join(__dirname, '../../../assets/fonts', 'THSarabun.ttf');
const fontBoldPath = path.join(__dirname, '../../../assets/fonts', 'THSarabun Bold.ttf');
const xmlTemplatePath = path.join(__dirname, '../../model/template/invoice-template.xml');

const generateInvoiceBase64 = async (data) => {
    try {
        const { conditionMonth, conditionYear, items } = data;
        const xmlTemplate = fs.readFileSync(xmlTemplatePath, 'utf8');

        // logger.info(`[Check Data]: month="${conditionMonth}", year="${conditionYear}", items=${Array.isArray(items) ? items.length : 0}`);

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

        // 🌟 ตั้งค่าตัวเลือก PDF พร้อมรหัสผ่านวันเดือนปีเกิดลูกค้า (ถ้ามีส่งเข้ามาใน data)
        const pdfOptions = {
            size: 'A4',
            margins: { top: marginTop, bottom: marginBottom, left: marginLeft, right: marginRight }
        };

        // Use the centralized security helper to format the password later
        const rawDob = data.birthDate || data.userPassword || '';

        const doc = new PDFDocument(pdfOptions);

        doc.registerFont('THSarabun', fontPath);
        doc.registerFont('THSarabunBold', fontBoldPath);

        const bufferPromise = new Promise((resolve, reject) => {
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => {
                const pdfBuffer = Buffer.concat(chunks);
                // logger.info(`Stream ended. Buffer generated successfully for Invoice No: ${conditionYear}`);
                resolve(pdfBuffer);
            });
            doc.on('error', (err) => reject(err));
        });

        const elements = Array.isArray(docStructure.element) ? docStructure.element : [docStructure.element];

        // วนลูปวาดโครงสร้างลง PDF
        for (const el of elements) {
            if (el.tag === 'text') {
                let textContent = String(el['#text'] || '');

                const fallLinemonth = '..........-..........';
                const fallLineyear = '.....-....';


                textContent = textContent
                    // 🌟 เพิ่ม \s* เข้าไปข้างในวงเล็บปีกกา เพื่อให้รองรับช่องว่างได้
                    .replace(/{{\s*conditionMonth\s*}}/g, conditionMonth || fallLinemonth)
                    .replace(/{{\s*conditionYear\s*}}/g, conditionYear || fallLineyear)
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

                doc.font(el.type === 'heading' ? 'THSarabunBold' : 'THSarabun')
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

                // 🌟 รอมันวาดตารางเสร็จจริงด้วยคำสั่ง await
                await doc.table({ headers, rows }, {
                    columnsSize: widths,
                    prepareHeader: () => doc.font(fontBoldPath).fontSize(16),
                    prepareRow: () => doc.font(fontPath).fontSize(14)
                });
            }
        }

        // 🌟 สั่งปิดเอกสารเมื่อกระบวนการลูปวาดทุกอย่างเสร็จสิ้นสนิท
        doc.end();

        // 🌟 รอรับ Buffer ของ PDF
        const unencryptedBuffer = await bufferPromise;

        // 🌟 เข้ารหัส PDF ผ่าน helper กลาง
        const { encryptPdfBuffer } = require('../../utils/pdfSecurityHelper');
        const encryptedBuffer = await encryptPdfBuffer(unencryptedBuffer, rawDob);

        // แปลงเป็น Base64 แล้วส่งกลับไป
        return encryptedBuffer.toString('base64');

    } catch (error) {
        logger.error(`เกิดข้อผิดพลาดในการสร้าง PDF: ${error.message}`);
        throw error;
    }
};

module.exports = {
    generateInvoiceBase64
};