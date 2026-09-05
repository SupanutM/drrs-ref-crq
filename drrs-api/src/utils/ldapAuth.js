const ldapjs = require('ldapjs');
const env = require('../config/env');
const baseLogger = require('./logger');
const logger = baseLogger.child({ context: 'ldapAuth' });

/**
 * ยืนยันตัวตนกับ Active Directory (AD) ด้วย username/password ผ่าน ldapjs
 * แปลงจากตัวอย่างเดิม (D:\backend\service\plugADService.js) ให้:
 *   - เป็น Promise (async/await ได้ตรงๆ)
 *   - ปิด connection (unbind) ทุก path ให้ครบ กันหลุด connection ค้าง
 *   - ไม่ log username/password ตรงๆ ลง log (ข้อมูลอ่อนไหว)
 *
 * @param {string} username
 * @param {string} password
 * @returns {Promise<object>} ข้อมูลผู้ใช้จาก AD (displayname, mail, department, ...)
 * @throws {Error} 'INVALID_CREDENTIALS' ถ้า bind ไม่ผ่าน, หรือ error อื่นถ้า LDAP ล่ม
 */
function authenticateAD(username, password) {
    return new Promise((resolve, reject) => {
        const bindDN = `${env.adDomain}\\${username}`;
        const ldapClient = ldapjs.createClient({
            url: env.adUrl,
            timeout: 10000,
            connectTimeout: 10000,
        });

        // log request ตอน bind — ไม่ log password เด็ดขาด (ข้อมูลอ่อนไหว)
        logger.info(`[LDAP Bind] request: url=${env.adUrl} bindDN=${bindDN}`);

        // เชื่อมต่อ LDAP server ไม่ได้เลย (network/DNS ผิด) — ต้อง unbind กันค้าง แล้ว reject
        ldapClient.on('error', (err) => {
            logger.error(`[LDAP Bind] client error: ${err.message}`);
            try { ldapClient.unbind(); } catch (_) { /* no-op */ }
            reject(new Error('LDAP_UNAVAILABLE'));
        });

        ldapClient.bind(bindDN, password, (bindErr) => {
            if (bindErr) {
                ldapClient.unbind();

                // แยกเคส "รหัสผ่าน/username ผิดจริง" (LDAP error code 49 / InvalidCredentialsError)
                // ออกจากเคส "เชื่อมต่อ AD server ไม่ได้" (DNS ผิด/server ล่ม/timeout) — ไม่งั้นจะ
                // รายงานผิดว่า "username หรือ password ไม่ถูกต้อง" ทั้งที่จริงคือ AD server เข้าไม่ถึง
                const isInvalidCredentials = bindErr.name === 'InvalidCredentialsError' || bindErr.code === 49;

                // log response ตอน bind ล้มเหลว — เก็บ name/code ของ error (ไม่ log message ดิบ อาจมี DN ติดมา)
                logger.warn(`[LDAP Bind] response: bindDN=${bindDN} name=${bindErr.name || '-'} code=${bindErr.code ?? '-'}`);

                if (isInvalidCredentials) {
                    return reject(new Error('INVALID_CREDENTIALS'));
                }

                return reject(new Error('LDAP_UNAVAILABLE'));
            }

            logger.info(`[LDAP Bind] response: bindDN=${bindDN} result=success`);

            // filter ใช้ cn= ตามไฟล์ตัวอย่างเดิม (D:\backend\service\plugADService.js) — ทีม AD
            // ตั้งค่า cn ให้เท่ากับ username ที่ใช้ login จริง (ยืนยันกับต้นทางแล้วว่าไม่ใช่ sAMAccountName)
            const searchOptions = {
                filter: `(cn=${username})`,
                scope: 'sub',
                attributes: [
                    'employeeID', 'employeeType', 'description', 'displayname',
                    'mail', 'title', 'department', 'streetAddress',
                    'division', 'otherPager', 'postalCode', 'distinguishedName',
                ],
            };

            // log request ตอนค้นหา user
            logger.info(`[LDAP Search] request: baseDn=${env.baseDn} filter=${searchOptions.filter} scope=${searchOptions.scope}`);

            const user = {};

            ldapClient.search(env.baseDn, searchOptions, (searchErr, searchRes) => {
                if (searchErr) {
                    logger.error(`[LDAP Search] response error: ${searchErr.message}`);
                    ldapClient.unbind();
                    return reject(new Error('LDAP_SEARCH_FAILED'));
                }

                searchRes.on('searchEntry', (entry) => {
                    entry.attributes.forEach((attr) => {
                        user[attr.type] = attr.vals[0];
                    });
                });

                searchRes.on('error', (err) => {
                    logger.error(`[LDAP Search] response stream error: ${err.message}`);
                    ldapClient.unbind();
                    reject(new Error('LDAP_SEARCH_FAILED'));
                });

                searchRes.on('end', (result) => {
                    ldapClient.unbind();

                    // log response ตอนค้นหาเสร็จ — เก็บ attribute ที่ได้กลับมาทั้งหมด (ไม่มีข้อมูลอ่อนไหวรุนแรง
                    // เป็นข้อมูลพนักงานในองค์กร ไม่ใช่ข้อมูลลูกค้า) ช่วย debug เคส AD คืนค่าไม่ตรงที่คาดไว้
                    logger.info(`[LDAP Search] response: status=${result.status} user=${JSON.stringify(user)}`);

                    if (result.status === 0) {
                        return resolve({
                            username,
                            displayName: user.displayname || username,
                            email: user.mail || null,
                            department: user.department || null,
                            title: user.title || null,
                        });
                    }
                    reject(new Error('LDAP_SEARCH_FAILED'));
                });
            });
        });
    });
}

module.exports = { authenticateAD };
