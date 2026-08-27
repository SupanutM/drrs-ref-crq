const puppeteer = require('puppeteer');
const baseLogger = require('./logger');

const logger = baseLogger.child({ context: 'browserPool' });

/**
 * browserPool — ตัวจัดการ Chromium ที่ใช้ร่วมกันทั้งระบบ
 *
 * ===== ที่มา (วัดจริงบนเครื่อง dev, template จริง, ได้ PDF 2 หน้า) =====
 * โค้ดเดิมเรียก puppeteer.launch() ใหม่ทุก request ทำให้เสียเวลา:
 *   puppeteer.launch()               6,433 ms
 *   browser.newPage()                  371 ms
 *   page.setContent(networkidle0)    1,008 ms
 *   page.pdf()                      11,317 ms   <- ค่าเตรียมระบบพิมพ์ครั้งแรก
 *   page.close()                        20 ms
 *   รวม                             19,289 ms
 *
 * พอใช้ Chromium ตัวเดิมซ้ำ (ไม่ launch ใหม่):
 *   browser.newPage()                   47 ms
 *   page.setContent(domcontentloaded)   37 ms
 *   page.pdf()                         253 ms   <- ลดลง 45 เท่า
 *   page.close()                        16 ms
 *   รวม                                353 ms
 *
 * จุดสำคัญ: ที่เร็วขึ้นไม่ใช่แค่ประหยัดเวลา launch แต่เป็นเพราะ Chromium
 * ที่เพิ่งเปิดใหม่ต้องเตรียมระบบพิมพ์กับโหลดฟอนต์ในการสร้าง PDF ครั้งแรก
 * ซึ่งจ่ายครั้งเดียวก็พอ โค้ดเดิมจ่ายซ้ำทุก request
 *
 * ===== หน้าที่ของไฟล์นี้ =====
 * 1. เปิด Chromium ครั้งเดียวแล้วแบ่งกันใช้
 * 2. จำกัดจำนวน page ที่เปิดพร้อมกัน (คิว) — ถ้าไม่จำกัด 100 คนกดพร้อมกัน
 *    ก็จะเปิด 100 page ซึ่งกิน RAM จนเครื่องล่ม
 * 3. ปิด page ให้เสมอแม้เกิด error (โค้ดเดิมไม่มี try/finally ทำให้
 *    Chromium ค้างกินแรมทุกครั้งที่สร้าง PDF พัง)
 * 4. ถ้า Chromium ตายเอง จะเปิดใหม่ให้อัตโนมัติในครั้งถัดไป
 *
 * ===== ทำไมไม่ต้องแก้ server.js =====
 * server.js ของ UAT ไม่ได้อยู่ใน repo (อยู่ใน .gitignore) ถ้าออกแบบให้ต้องไป
 * เรียก warmUp() จาก server.js จะเสี่ยง deploy ตกหล่น ไฟล์นี้จึงเปิด Chromium
 * เองแบบ lazy และอุ่นเครื่องให้เบื้องหลังตอนที่ถูก require ครั้งแรก
 *
 * ===== ค่าที่ปรับได้ผ่าน .env =====
 *   PDF_MAX_CONCURRENCY   จำนวน page ที่ทำงานพร้อมกันได้ (default 4)
 *   PDF_QUEUE_TIMEOUT_MS  รอคิวนานสุดกี่ ms ก่อนยอมแพ้ (default 60000)
 *   PDF_PAGE_TIMEOUT_MS   timeout ของ setContent/pdf (default 30000)
 *   PDF_WARMUP            ตั้ง 'false' เพื่อไม่ให้อุ่นเครื่องตอน start
 */

const MAX_CONCURRENCY = Number(process.env.PDF_MAX_CONCURRENCY) || 4;
const QUEUE_TIMEOUT_MS = Number(process.env.PDF_QUEUE_TIMEOUT_MS) || 60000;
const PAGE_TIMEOUT_MS = Number(process.env.PDF_PAGE_TIMEOUT_MS) || 30000;

const LAUNCH_OPTIONS = {
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
};

/** Promise ของ browser ที่ใช้ร่วมกัน — null = ยังไม่เปิด หรือเพิ่งตายไป */
let browserPromise = null;

/** จำนวน page ที่กำลังทำงานอยู่ */
let activeCount = 0;

/** คิวของคนที่รอ slot ว่าง */
const queue = [];

/**
 * เปิด Chromium (ครั้งเดียว) และคืน browser ที่ใช้ร่วมกัน
 * ถ้า Chromium ตายไป ครั้งถัดไปจะเปิดใหม่ให้เอง
 */
const getBrowser = () => {
    if (browserPromise) return browserPromise;

    logger.info('เปิด Chromium (ครั้งเดียว ใช้ร่วมกันทุก request)');
    const started = Date.now();

    browserPromise = puppeteer
        .launch(LAUNCH_OPTIONS)
        .then((browser) => {
            logger.info(`เปิด Chromium สำเร็จใน ${Date.now() - started} ms`);

            // ถ้า Chromium ตายเอง (crash / ถูก kill) ให้ล้างค่าไว้
            // ครั้งถัดไปที่มีคนขอใช้ จะเปิดใหม่ให้อัตโนมัติ
            browser.on('disconnected', () => {
                logger.warn('Chromium หลุดการเชื่อมต่อ จะเปิดใหม่เมื่อมี request ถัดไป');
                browserPromise = null;
            });

            return browser;
        })
        .catch((error) => {
            // ล้างค่าเพื่อให้ request ถัดไปลองเปิดใหม่ได้ ไม่ค้างพังถาวร
            browserPromise = null;
            logger.error(`เปิด Chromium ไม่สำเร็จ: ${error.message}`);
            throw error;
        });

    return browserPromise;
};

/** ขอ slot จากคิว — คืน Promise ที่ resolve เมื่อถึงคิว */
const acquireSlot = () => {
    if (activeCount < MAX_CONCURRENCY) {
        activeCount += 1;
        return Promise.resolve();
    }

    logger.warn(`คิวสร้าง PDF เต็ม (กำลังทำ ${activeCount} งาน) มีคนรออยู่ ${queue.length + 1} คน`);

    return new Promise((resolve, reject) => {
        const waiter = { resolve, reject, timer: null };

        waiter.timer = setTimeout(() => {
            const index = queue.indexOf(waiter);
            if (index !== -1) queue.splice(index, 1);
            reject(new Error(`รอคิวสร้าง PDF เกิน ${QUEUE_TIMEOUT_MS} ms`));
        }, QUEUE_TIMEOUT_MS);

        queue.push(waiter);
    });
};

/** คืน slot ให้คนถัดไปในคิว */
const releaseSlot = () => {
    const waiter = queue.shift();
    if (waiter) {
        clearTimeout(waiter.timer);
        waiter.resolve();
        return;
    }
    activeCount = Math.max(0, activeCount - 1);
};

/**
 * ขอ page มาใช้ 1 หน้า ทำงานตาม callback แล้วปิดให้เสมอ
 *
 * @param {(page: import('puppeteer').Page) => Promise<any>} fn
 * @returns {Promise<any>} ค่าที่ callback คืนมา
 */
const withPage = async (fn) => {
    await acquireSlot();

    let page = null;
    try {
        const browser = await getBrowser();
        page = await browser.newPage();
        page.setDefaultTimeout(PAGE_TIMEOUT_MS);
        page.setDefaultNavigationTimeout(PAGE_TIMEOUT_MS);
        return await fn(page);
    } finally {
        // ปิด page ให้เสมอ ไม่ว่าจะสำเร็จหรือพัง
        // (โค้ดเดิมไม่มีส่วนนี้ ทำให้ Chromium ค้างทุกครั้งที่พัง)
        if (page) {
            try {
                await page.close();
            } catch (error) {
                logger.warn(`ปิด page ไม่สำเร็จ: ${error.message}`);
            }
        }
        releaseSlot();
    }
};

/**
 * อุ่นเครื่อง — จ่ายค่าเตรียมระบบพิมพ์ของ Chromium ล่วงหน้า
 * ถ้าไม่ทำ ลูกค้าคนแรกที่กดสร้างสัญญาจะต้องรอ ~19 วินาทีคนเดียว
 */
const warmUp = async () => {
    const started = Date.now();
    try {
        await withPage(async (page) => {
            await page.setContent('<html><body>warmup</body></html>', {
                waitUntil: 'domcontentloaded',
            });
            await page.pdf({ format: 'A4' });
        });
        logger.info(`อุ่นเครื่อง Chromium เสร็จใน ${Date.now() - started} ms (พร้อมสร้าง PDF)`);
    } catch (error) {
        // อุ่นเครื่องพลาดไม่ใช่เรื่องคอขวด ปล่อยให้ request จริงลองใหม่เอง
        logger.warn(`อุ่นเครื่อง Chromium ไม่สำเร็จ: ${error.message}`);
    }
};

/** ปิด Chromium (ใช้ตอนปิดระบบ หรือในเทสต์) */
const closeBrowser = async () => {
    if (!browserPromise) return;
    const pending = browserPromise;
    browserPromise = null;
    try {
        const browser = await pending;
        await browser.close();
        logger.info('ปิด Chromium แล้ว');
    } catch (error) {
        logger.warn(`ปิด Chromium ไม่สำเร็จ: ${error.message}`);
    }
};

/** สถานะปัจจุบัน (ไว้ debug / เขียนเทสต์) */
const getStats = () => ({
    browserOpen: browserPromise !== null,
    activeCount,
    queueLength: queue.length,
    maxConcurrency: MAX_CONCURRENCY,
});

// อุ่นเครื่องเบื้องหลังตอนที่ไฟล์นี้ถูก require ครั้งแรก (ตอน server start)
// ไม่ block การ start และไม่โยน error ออกไป
//
// หน่วงไว้ก่อนโดยตั้งใจ: การเปิด Chromium กิน CPU หนัก ถ้าทำทันทีจะไปแย่ง
// กับการต่อ DataSource ตอน start จนต่อ DB ไม่ทัน timeout (เจอจริงตอนทดสอบ:
// "Connection terminated due to connection timeout" แล้ว server ไม่ listen เลย)
const WARMUP_DELAY_MS = Number(process.env.PDF_WARMUP_DELAY_MS) || 8000;

if (process.env.PDF_WARMUP !== 'false') {
    const timer = setTimeout(() => {
        warmUp().catch(() => { });
    }, WARMUP_DELAY_MS);
    // ไม่ให้ timer นี้กันโปรเซสปิด (สำคัญกับเทสต์และ script สั้นๆ)
    if (typeof timer.unref === 'function') timer.unref();
}

module.exports = {
    withPage,
    warmUp,
    closeBrowser,
    getStats,
};
