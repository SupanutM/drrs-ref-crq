const baseLogger = require('./logger');

const logger = baseLogger.child({ context: 'db' });

/**
 * DbLogger — TypeORM logger ของ DRRS
 *
 * เหตุผลที่ต้องเขียนเอง:
 * logger มาตรฐานของ TypeORM พิมพ์ค่า parameters ของ query ออกมาด้วย
 * (`-- PARAMETERS: [...]`) ซึ่งมีชื่อ-นามสกุลลูกค้าที่ถอดรหัสแล้ว
 * ลงไฟล์ text บนดิสก์ ขัดกับกฎห้าม log ข้อมูลส่วนบุคคล
 *
 * ตัวนี้ log แค่ตัว SQL ไม่เอา parameters ทุกกรณี
 *
 * หมายเหตุ: TypeORM จะเรียก method เหล่านี้ทุกครั้งโดยไม่สนค่า `logging`
 * ในตัวเลือกของ DataSource ดังนั้นการเปิด/ปิดจึงต้องตัดสินใจในนี้เอง
 */
class DbLogger {
    /**
     * @param {{ logQueries?: boolean }} options
     *        logQueries = true จะ log ทุก query (ควรเปิดเฉพาะตอนไล่ปัญหา)
     */
    constructor(options = {}) {
        this.logQueries = options.logQueries === true;
    }

    /** ยุบ whitespace ให้เหลือบรรทัดเดียวและตัดให้สั้น กัน log บวม */
    _clean(query) {
        const oneLine = String(query).replace(/\s+/g, ' ').trim();
        return oneLine.length > 500 ? `${oneLine.slice(0, 500)}...` : oneLine;
    }

    logQuery(query) {
        if (!this.logQueries) return;
        logger.info(`query: ${this._clean(query)}`);
    }

    logQueryError(error, query) {
        const message = error instanceof Error ? error.message : String(error);
        logger.error(`query ล้มเหลว: ${message} | sql: ${this._clean(query)}`);
    }

    logQuerySlow(time, query) {
        logger.warn(`query ช้า ${time} ms | sql: ${this._clean(query)}`);
    }

    logSchemaBuild(message) {
        logger.info(`schema: ${message}`);
    }

    logMigration(message) {
        logger.info(`migration: ${message}`);
    }

    log(level, message) {
        if (level === 'warn') {
            logger.warn(String(message));
        } else {
            logger.info(String(message));
        }
    }
}

module.exports = DbLogger;
