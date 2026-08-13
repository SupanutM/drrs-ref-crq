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

        logger.info(`[Check Data]: name="${conditionMonth}", year="${conditionYear}", rawData=${JSON.stringify(data)}`);

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

        // ดึงวันเดือนปีเกิดลูกค้าจาก payload (ฟิลด์ birthDate หรือ userPassword)
        const rawDob = data.birthDate || data.userPassword || '';
        const formattedPassword = String(rawDob).replace(/[^a-zA-Z0-9]/g, ''); // ลบเครื่องหมาย - หรือ / ออก เหลือเฉพาะตัวเลข เช่น 25300115 หรือ 15012530

        if (formattedPassword) {
            pdfOptions.userPassword = formattedPassword;
            pdfOptions.ownerPassword = process.env.PDF_OWNER_PASSWORD || 'GSB_SECRET_KEY_DRRS';
            pdfOptions.permissions = {
                printing: 'highResolution',
                modifying: false,
                copying: false,
                annotating: false
            };
            logger.info(`[PDF Security]: ตั้งค่ารหัสผ่าน userPassword จากวันเดือนปีเกิด/เลขบัตรลูกค้าเรียบร้อยแล้ว (${formattedPassword})`);
        } else {
            logger.warn(`[PDF Security Warning]: ไม่พบข้อมูลวันเดือนปีเกิดลูกค้าใน Request Payload (rawDob="${rawDob}") จึงไม่ได้ตั้งค่าล็อครหัสผ่าน PDF`);
        }

        const doc = new PDFDocument(pdfOptions);

        doc.registerFont('THSarabun', fontPath);
        doc.registerFont('THSarabunBold', fontBoldPath);

        const base64Promise = new Promise((resolve, reject) => {
            const chunks = [];
            doc.on('data', (chunk) => chunks.push(chunk));
            doc.on('end', () => {
                const base64String = Buffer.concat(chunks).toString('base64');
                logger.info(`Stream ended. Base64 generated successfully for Invoice No: ${conditionYear}`);
                resolve(base64String);
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

        // รอผลลัพธ์ Base64 ส่งกลับไป
        return await base64Promise;

    } catch (error) {
        logger.error(`เกิดข้อผิดพลาดในการสร้าง PDF: ${error.message}`);
        throw error;
    }
};

module.exports = {
    generateInvoiceBase64
};