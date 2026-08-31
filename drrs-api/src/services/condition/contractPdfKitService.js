const path = require('path');
const fsp = require('fs/promises');
const PDFDocument = require('pdfkit');
const { PDFDocument: PdfLibDocument } = require('pdf-lib-plus-encrypt');
const baseLogger = require('../../utils/logger');
const { applyPdfEncryption } = require('../../utils/pdfSecurityHelper');

const logger = baseLogger.child({ context: 'contractPdfKit' });

// ---- ฟอนต์ไทย (มีอยู่แล้วใน assets ใช้ร่วมกับ /generate-pdf) ----
const FONT_DIR = path.join(__dirname, '../../../assets/fonts');
const FONT_REGULAR = path.join(FONT_DIR, 'THSarabun.ttf');
const FONT_BOLD = path.join(FONT_DIR, 'THSarabun Bold.ttf');

// ---- เอกสารแนบท้าย (ข้อตกลงและเงื่อนไข) ที่เป็นไฟล์นิ่ง ----
const CONTRACT_PDF_PATH = path.join(__dirname, '../../../assets/contract_download.pdf');

// ---- ขนาดหน้า A4 (จุด) / ระยะขอบ ----
const PAGE = { size: 'A4', margin: 40 };
const PAGE_WIDTH = 595.28;
const CONTENT_LEFT = PAGE.margin;
const CONTENT_WIDTH = PAGE_WIDTH - PAGE.margin * 2;
const PAGE_BOTTOM = 841.89 - PAGE.margin; // ขอบล่างสุดก่อนต้องขึ้นหน้าใหม่

// ---- สีตามเทมเพลตเดิม (HTML/CSS) ----
const COLOR = {
    headerPink: '#ffb3c6',   // หัวตาราง/หัวข้อ
    valuePink: '#ffebf0',    // ช่องค่าข้อมูล
    border: '#ffb3c6',
    text: '#000000',
};

const FONT_SIZE = 15; // ~16pt ในเทมเพลตเดิม (pdfkit ใช้ pt เท่ากับ px ที่ 72dpi)

/**
 * แคช contract.pdf ในหน่วยความจำ (ไฟล์นิ่ง ไม่เปลี่ยนระหว่างรัน)
 */
let contractPdfPromise = null;
const getContractPdfBytes = () => {
    if (contractPdfPromise) return contractPdfPromise;
    contractPdfPromise = fsp
        .readFile(CONTRACT_PDF_PATH)
        .then((bytes) => {
            // logger.info(`โหลด contract.pdf เข้าหน่วยความจำแล้ว (${(bytes.length / 1024).toFixed(1)} KB)`);
            return bytes;
        })
        .catch((error) => {
            contractPdfPromise = null;
            logger.warn(`อ่าน contract.pdf ไม่ได้ จะออกเฉพาะหน้าสรุป: ${error.message}`);
            return null;
        });
    return contractPdfPromise;
};

const num = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
};
const safe = (v) => (v === undefined || v === null ? '' : String(v));

/**
 * ตัวช่วยวาด: เผื่อที่ว่างพอไหม ถ้าไม่พอขึ้นหน้าใหม่
 */
const ensureSpace = (doc, needed) => {
    if (doc.y + needed > PAGE_BOTTOM) doc.addPage();
};

/**
 * วาดแถวหัวข้อ (พื้นขาว ตัวหนา จัดกลาง) — เช่น "รายละเอียดสัญญา"
 */
const drawSectionTitle = (doc, text, align = 'center') => {
    const gapBefore = 8;
    const gapAfter = 6;
    ensureSpace(doc, gapBefore + FONT_SIZE * 1.3 + gapAfter);
    doc.font('bold').fontSize(FONT_SIZE).fillColor(COLOR.text);
    doc.text(text, CONTENT_LEFT, doc.y + gapBefore, { width: CONTENT_WIDTH, align });
    doc.y += gapAfter;
    doc.x = CONTENT_LEFT;
};

/**
 * วาดคู่ label (พื้นขาว) + value (พื้นชมพูอ่อน) เต็มความกว้าง — แบบเดียวกับเทมเพลต
 */
const drawLabelValue = (doc, label, value) => {
    const text = safe(value);
    const padX = 10;    // ระยะซ้าย-ขวาในกล่อง (เทียบ padding 12px เดิม)
    const padY = 6;     // ระยะบน-ล่างในกล่อง (เทียบ padding 6px เดิม)
    const gapBeforeLabel = 6;   // ช่องว่างก่อนหัวข้อ (อากาศระหว่างบล็อก)
    const gapLabelValue = 4;    // ช่องว่างระหว่าง label กับกล่องค่า
    const gapAfter = 8;         // ช่องว่างหลังกล่องค่า ก่อนบล็อกถัดไป
    const lineH = FONT_SIZE * 1.3;

    // คำนวณความสูงกล่องค่าจากข้อความจริง (ที่อยู่ยาวๆ จะได้ไม่ล้น)
    doc.font('regular').fontSize(FONT_SIZE);
    const textH = text
        ? doc.heightOfString(text, { width: CONTENT_WIDTH - padX * 2, lineGap: 2 })
        : lineH;
    const valueH = Math.max(lineH, textH) + padY * 2;

    ensureSpace(doc, gapBeforeLabel + lineH + gapLabelValue + valueH + gapAfter);

    // label: พื้นขาว ตัวหนา
    let y = doc.y + gapBeforeLabel;
    doc.font('bold').fontSize(FONT_SIZE).fillColor(COLOR.text);
    doc.text(safe(label), CONTENT_LEFT + padX, y, { width: CONTENT_WIDTH - padX * 2 });
    y += lineH + gapLabelValue;

    // value: พื้นชมพูอ่อน (สูงตามเนื้อหา)
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, valueH).fill(COLOR.valuePink);
    doc.fillColor(COLOR.text).font('regular').fontSize(FONT_SIZE);
    doc.text(text, CONTENT_LEFT + padX, y + padY, { width: CONTENT_WIDTH - padX * 2, lineGap: 2 });

    doc.y = y + valueH + gapAfter;
    doc.x = CONTENT_LEFT;
};

/**
 * วาดตาราง 3 ช่อง: ภาระหนี้คงเหลือ / เงินต้น / ดอกเบี้ย
 */
const drawThreeCol = (doc, acc) => {
    const cells = [
        ['ภาระหนี้คงเหลือ', num(acc.outstandingBalance)],
        ['เงินต้น', num(acc.principal)],
        ['ดอกเบี้ย', num(acc.interest)],
    ];
    const colW = CONTENT_WIDTH / 3;
    const headH = 22;
    const valH = 24;
    ensureSpace(doc, headH + valH);

    let y = doc.y;
    // หัว (พื้นขาว ตัวหนา จัดกลาง)
    doc.font('bold').fontSize(FONT_SIZE).fillColor(COLOR.text);
    cells.forEach((c, i) => {
        doc.text(c[0], CONTENT_LEFT + i * colW, y + 4, { width: colW, align: 'center' });
    });
    y += headH;
    // ค่า (พื้นชมพูอ่อน จัดกลาง)
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, valH).fill(COLOR.valuePink);
    doc.fillColor(COLOR.text).font('regular').fontSize(FONT_SIZE);
    cells.forEach((c, i) => {
        doc.text(c[1], CONTENT_LEFT + i * colW, y + 5, { width: colW, align: 'center' });
    });
    doc.y = y + valH + 4;
    doc.x = CONTENT_LEFT;
};

/**
 * วาดตารางกรอบชมพู 2 คอลัมน์ (label | value) สำหรับแผนผ่อน/ปิดบัญชี
 */
const drawKeyValueTable = (doc, rows) => {
    const labelW = CONTENT_WIDTH * 0.3;
    const valueW = CONTENT_WIDTH * 0.7;
    const rowH = 24;
    ensureSpace(doc, rowH * rows.length);

    rows.forEach(([label, value]) => {
        const y = doc.y;
        // กรอบ label
        doc.rect(CONTENT_LEFT, y, labelW, rowH).strokeColor(COLOR.border).stroke();
        doc.font('bold').fontSize(FONT_SIZE).fillColor(COLOR.text);
        doc.text(safe(label), CONTENT_LEFT + 6, y + 5, { width: labelW - 12 });
        // กรอบ value (พื้นชมพูอ่อน)
        doc.rect(CONTENT_LEFT + labelW, y, valueW, rowH).fill(COLOR.valuePink);
        doc.rect(CONTENT_LEFT + labelW, y, valueW, rowH).strokeColor(COLOR.border).stroke();
        doc.fillColor(COLOR.text).font('regular').fontSize(FONT_SIZE);
        doc.text(safe(value), CONTENT_LEFT + labelW + 6, y + 5, { width: valueW - 12 });
        doc.y = y + rowH;
        doc.x = CONTENT_LEFT;
    });
    doc.moveDown(0.2);
};

/**
 * วาดตารางผ่อนชำระ: (งวด) / ตั้งแต่งวดเดือน / ถึงงวดเดือน / ยอดผ่อนชำระ (บาท)
 */
const drawInstallmentTable = (doc, acc) => {
    const cols = [
        { title: '', width: CONTENT_WIDTH * 0.1, align: 'center' },
        { title: 'ตั้งแต่งวดเดือน', width: CONTENT_WIDTH * 0.3, align: 'center' },
        { title: 'ถึงงวดเดือน', width: CONTENT_WIDTH * 0.3, align: 'center' },
        { title: 'ยอดผ่อนชำระ (บาท)', width: CONTENT_WIDTH * 0.3, align: 'center' },
    ];
    const rowH = 24;

    // หัวข้อ "ตารางผ่อนชำระ" เต็มแถว
    ensureSpace(doc, rowH * 2);
    let y = doc.y;
    doc.rect(CONTENT_LEFT, y, CONTENT_WIDTH, rowH).strokeColor(COLOR.border).stroke();
    doc.font('bold').fontSize(FONT_SIZE).fillColor(COLOR.text);
    doc.text('ตารางผ่อนชำระ', CONTENT_LEFT, y + 5, { width: CONTENT_WIDTH, align: 'center' });
    doc.y = y + rowH;

    // แถวหัวคอลัมน์
    const drawTableRow = (cells, isHeader) => {
        ensureSpace(doc, rowH);
        const yy = doc.y;
        let x = CONTENT_LEFT;
        doc.font(isHeader ? 'bold' : 'regular').fontSize(FONT_SIZE).fillColor(COLOR.text);
        cols.forEach((c, i) => {
            doc.rect(x, yy, c.width, rowH).strokeColor(COLOR.border).stroke();
            doc.text(safe(cells[i]), x + 3, yy + 5, { width: c.width - 6, align: c.align });
            x += c.width;
        });
        doc.y = yy + rowH;
        doc.x = CONTENT_LEFT;
    };

    drawTableRow(cols.map((c) => c.title), true);

    const installments = Array.isArray(acc.installments) && acc.installments.length > 0
        ? acc.installments
        : [{ period: 1, startMonth: acc.startMonth, endMonth: acc.endMonth, amount: acc.paymentAmount }];

    installments.forEach((inst, i) => {
        drawTableRow([
            safe(inst.period || i + 1),
            safe(inst.startMonth) || '',
            safe(inst.endMonth) || '',
            num(inst.amount != null ? inst.amount : acc.paymentAmount),
        ], false);
    });
    doc.moveDown(0.3);
};

/**
 * วาดหน้าสรุปแผนของลูกค้า ตาม layout เดียวกับ planSummary.html
 */
const drawSummary = (doc, customerInfo, accounts) => {
    const info = customerInfo || {};
    const list = Array.isArray(accounts) ? accounts : [];

    drawSectionTitle(doc, 'รายละเอียดสัญญา', 'center');

    // ---- ข้อมูลลูกค้า ----
    drawSectionTitle(doc, 'ข้อมูลลูกค้า', 'left');
    drawLabelValue(doc, 'ชื่อ-นามสกุล', `${safe(info.firstName)} ${safe(info.lastName)}`.trim());
    drawLabelValue(doc, 'เลขที่บัตรประชาชน', safe(info.citizenId));
    drawLabelValue(doc, 'ที่อยู่ตามทะเบียนบ้าน', safe(info.address));
    drawLabelValue(doc, 'เบอร์โทรติดต่อ', safe(info.mobileNo || info.telNo));

    if (list.length === 0) return;

    // ---- รายละเอียดบัญชีเงินกู้ ----
    doc.moveDown(0.3);
    drawSectionTitle(doc, 'รายละเอียดบัญชีเงินกู้', 'center');

    list.forEach((acc) => {
        const isHaircut = !!acc.isHaircut;

        doc.moveDown(0.2);
        drawSectionTitle(doc, isHaircut ? 'แผนปิดบัญชี' : 'แผนผ่อนชำระ', 'center');

        drawLabelValue(doc, 'เลขที่บัญชี', safe(acc.accountNo));
        drawLabelValue(doc, 'ประเภทสินเชื่อ', safe(acc.loanType) || '-');
        drawLabelValue(doc, 'วันทำสัญญา', safe(acc.contractDate));
        drawLabelValue(doc, 'วงเงินกู้', num(acc.loanAmount));

        // ตาราง 3 ช่อง ภาระหนี้คงเหลือ/เงินต้น/ดอกเบี้ย
        drawThreeCol(doc, acc);

        if (!isHaircut) {
            // แผนการชำระหนี้
            drawSectionTitle(doc, 'แผนการชำระหนี้', 'center');
            drawKeyValueTable(doc, [
                ['ค่างวด', num(acc.paymentAmount)],
                ['อัตราดอกเบี้ย *', safe(acc.interestRate) || 'MRR ต่อปี'],
                ['จำนวนงวด', acc.installmentTerms ? String(parseInt(acc.installmentTerms, 10)) : ''],
                ['เริ่มชำระ', safe(acc.startPaymentDate || acc.startMonth)],
            ]);
            doc.font('regular').fontSize(12).fillColor(COLOR.text)
                .text('*MRR ตามประกาศของธนาคาร', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
            doc.moveDown(0.3);

            drawInstallmentTable(doc, acc);

            doc.font('regular').fontSize(12).fillColor(COLOR.text)
                .text('ท่านตกลงชำระหนี้ให้ธนาคารทั้งหมดในงวดสุดท้าย', CONTENT_LEFT, doc.y, { width: CONTENT_WIDTH });
            doc.moveDown(0.4);
        } else {
            // แผนปิดบัญชี (Haircut)
            drawKeyValueTable(doc, [
                ['ยอดปิดบัญชี', num(acc.paymentAmount)],
                ['ชำระภายในวันที่', safe(acc.endDate)],
            ]);
            doc.moveDown(0.4);
        }
    });
};

/**
 * สร้างไฟล์สัญญา PDF (หน้าสรุป + contract.pdf) พร้อมใส่รหัสผ่าน — ไม่ใช้ Chromium
 *
 * วาดด้วย pdfkit ซึ่งเป็น JS ล้วน ไม่ต้องเปิด browser จึงไม่กิน RAM/CPU ค้าง
 * (เดิมใช้ puppeteer เปิด Chromium ครั้งแรก ~19 วินาที และค้างกินทรัพยากร)
 *
 * layout วาดตาม planSummary.html เดิม (หัวข้อ/สีชมพู/ตารางเดียวกัน)
 *
 * คืน 2 เวอร์ชันจากเอกสารชุดเดียวกัน (เนื้อหาตรงกัน 100%):
 *   - preview: ไม่ใส่รหัส สำหรับโชว์บนจอ (ไม่ให้เบราว์เซอร์เด้งถามรหัส)
 *   - download: ใส่รหัส (วันเกิดลูกค้า) สำหรับดาวน์โหลด/เก็บ/ส่งเมล
 *
 * @param {object} customerInfo
 * @param {Array} selectedAccounts
 * @returns {Promise<{ preview: Buffer, download: Buffer }>}
 */
const generateContractPdf = async (customerInfo, selectedAccounts) => {
    const summaryBuffer = await new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ size: PAGE.size, margin: PAGE.margin, autoFirstPage: true });
            doc.registerFont('regular', FONT_REGULAR);
            doc.registerFont('bold', FONT_BOLD);

            const chunks = [];
            doc.on('data', (c) => chunks.push(c));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);

            drawSummary(doc, customerInfo, selectedAccounts);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });

    const contractPdfBytes = await getContractPdfBytes();

    const merged = await PdfLibDocument.create();

    const summaryDoc = await PdfLibDocument.load(summaryBuffer);
    const summaryPages = await merged.copyPages(summaryDoc, summaryDoc.getPageIndices());
    summaryPages.forEach((p) => merged.addPage(p));

    if (contractPdfBytes) {
        const contractDoc = await PdfLibDocument.load(contractPdfBytes);
        const contractPages = await merged.copyPages(contractDoc, contractDoc.getPageIndices());
        contractPages.forEach((p) => merged.addPage(p));
    }

    // 1. เวอร์ชันโชว์บนจอ — save "ก่อน" ใส่รหัส (react-pdf จะได้ไม่เด้งถามรหัส)
    const previewBytes = await merged.save({ useObjectStreams: false });

    // 2. เวอร์ชันดาวน์โหลด — ใส่รหัส (วันเกิดลูกค้า) แล้ว save จากเอกสารชุดเดียวกัน
    //    applyPdfEncryption แก้ในตัว merged จึงต้องทำหลัง save preview
    applyPdfEncryption(merged, customerInfo?.birthday);
    const downloadBytes = await merged.save({ useObjectStreams: false });

    return {
        preview: Buffer.from(previewBytes),
        download: Buffer.from(downloadBytes),
    };
};

// หมายเหตุ: เดิมมีฟังก์ชัน savePdfToDisk() เขียนไฟล์ PDF ลงดิสก์ที่ backend
// เลิกใช้แล้ว (เปลือง Disk IO) — คืน PDF เป็น base64 ให้ผู้เรียกไปเก็บที่ปลายทางแทน

module.exports = {
    generateContractPdf
};
