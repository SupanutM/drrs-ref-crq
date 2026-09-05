const { ILike } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblAdminUser = require('../../entities/tblAdminUser');
const { authenticateAD } = require('../../utils/ldapAuth');
const { signAdminSession } = require('../../utils/jwt');
const env = require('../../config/env');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'adminAuthService' });

/**
 * Login admin ผ่าน Active Directory:
 *   1. Bind กับ AD ด้วย username/password ที่กรอกมา (ดู utils/ldapAuth.js)
 *   2. เช็คหน่วยงาน (department) กับ allowlist ใน .env — ไม่ผ่านก็ปฏิเสธ login เลย
 *   3. เช็คว่ามีแถวใน tbl_admin_user ที่ role='ADMIN' ไหม (read-only ไม่สร้าง/แก้แถวให้ผู้ใช้ทั่วไป)
 *   4. ออก admin session token (JWT) กลับไปให้ frontend เก็บไว้เรียก endpoint อื่นต่อ
 *
 * ไม่เก็บ password ไว้ที่ไหนเลย (ยืนยันตัวตนกับ AD ทุกครั้ง ไม่แคชรหัสผ่าน)
 */
const loginWithAD = async (username, password) => {
    if (!username || !password) {
        return { success: false, statusCode: 400, message: 'กรุณากรอก username และ password' };
    }

    let adUser;

    if (env.adminLoginBypass) {
        // ****** BYPASS MODE — DEV/TEST เท่านั้น ไม่เช็ค password กับ AD จริง ******
        // เปิดจาก ADMIN_LOGIN_BYPASS=true ใน .env — ต้องปิด (false/ลบออก) ก่อน deploy ทุกครั้ง
        logger.warn(`[BYPASS] Admin login bypass เปิดอยู่ — login ผ่านทันทีโดยไม่เช็ค AD สำหรับ username=${username}`);
        adUser = {
            username,
            displayName: username,
            email: null,
        };
    } else {
        try {
            adUser = await authenticateAD(username, password);
        } catch (error) {
            if (error.message === 'INVALID_CREDENTIALS') {
                return { success: false, statusCode: 401, message: 'Username หรือ Password ไม่ถูกต้อง' };
            }
            logger.error(`AD authentication error: ${error.message}`);
            // AD server เข้าไม่ถึง (DNS/network/timeout) — ไม่ใช่ auth ผิด ใช้ 503 ให้ frontend/ops แยกเคสได้
            return { success: false, statusCode: 503, message: 'ไม่สามารถเชื่อมต่อระบบยืนยันตัวตนได้ กรุณาลองใหม่ในภายหลัง' };
        }
    }

    // เช็คหน่วยงาน (department จาก AD) กับ allowlist ที่ตั้งไว้ใน .env — ถ้าไม่ตั้งค่า allowlist "AD_ALLOWED_DEPARTMENTS"
    // ไว้เลย (AD_ALLOWED_DEPARTMENTS ว่าง) ถือว่าไม่จำกัด อนุญาตทุกหน่วยงาน (ต้องระวังตั้งค่าจริงก่อน
    // deploy ถ้าต้องการจำกัดจริง)
    if (env.adAllowedDepartments.length > 0) {
        const userDepartment = (adUser.department || '').trim();
        const isAllowed = env.adAllowedDepartments.some(
            (allowed) => allowed.toLowerCase() === userDepartment.toLowerCase()
        );
        if (!isAllowed) {
            logger.warn(`Login ถูกปฏิเสธ (หน่วยงานไม่อยู่ใน allowlist): username=${username} department=${userDepartment}`);
            return {
                success: false,
                statusCode: 403,
                message: 'หน่วยงานของคุณไม่ได้รับอนุญาตให้เข้าใช้งานระบบนี้',
            };
        }
    }

    // tbl_admin_user ใช้เป็น whitelist "คนที่ import ข้อมูลได้" (role='ADMIN'/'SUPERADMIN') เท่านั้น
    // — เป็นการเช็คแบบ read-only ไม่ insert/update แถวใหม่ให้ผู้ใช้ทั่วไปอีกต่อไป (เดิมทุกคนที่
    // login AD ผ่านจะถูกสร้างแถวเก็บไว้ ทำให้ตารางนี้ปนกับผู้ใช้ทั่วไปที่ไม่ได้มีสิทธิ์ import)
    // ถ้าไม่มีแถว หรือมีแถวแต่ role ไม่ใช่ ADMIN/SUPERADMIN — ถือเป็นผู้ใช้ทั่วไป (role=null) ทำได้
    // แค่ reprint สัญญา
    //
    // ใช้ ILike (case-insensitive) แทน exact match — AD เองไม่สนตัวพิมพ์เล็ก/ใหญ่ตอน bind อยู่แล้ว
    // (bind ผ่านได้ไม่ว่าจะพิมพ์ "SupanutM"/"supanutm"/"SUPANUTM") แต่ Postgres เทียบ varchar แบบ
    // case-sensitive โดย default ถ้าใช้ exact match ตรงนี้ คนที่พิมพ์ username คนละเคสกับที่ admin
    // ตั้งไว้ในตาราง (เช่น login ด้วย "supanutm" แต่ในตารางเก็บ "SupanutM") จะหาแถวไม่เจอ ทำให้ role
    // หลุดเป็นผู้ใช้ทั่วไปทั้งที่ตั้งสิทธิ์ไว้จริง
    const repo = AppDataSource.getRepository(tblAdminUser);
    const adminUser = await repo.findOne({ where: { username: ILike(adUser.username) } });

    let role = null;
    // username ที่ใช้ต่อ (ออก token/ตอบกลับ) — ถ้าเจอแถวในตาราง ใช้ตัวสะกดตามที่เก็บใน DB จริง
    // (ไม่ใช่ตามที่ผู้ใช้พิมพ์มา) กันปัญหาการเทียบ username ตรงๆ ที่จุดอื่น (เช่น เช็คว่าเป็นแถว
    // ของตัวเองไหมตอนแก้ role/status ในหน้าจัดการสิทธิ์) พลาดเพราะตัวพิมพ์ไม่ตรงกัน
    let resolvedUsername = adUser.username;
    if (adminUser) {
        if (adminUser.status !== '1') {
            return { success: false, statusCode: 403, message: 'บัญชีนี้ถูกระงับการใช้งาน กรุณาติดต่อผู้ดูแลระบบ' };
        }
        resolvedUsername = adminUser.username;
        if (adminUser.role === 'ADMIN' || adminUser.role === 'SUPERADMIN') {
            role = adminUser.role;
            // ยัง sync display name/email/last login ให้แถว ADMIN/SUPERADMIN ที่มีอยู่แล้วเท่านั้น (ไม่สร้างแถวใหม่)
            adminUser.displayName = adUser.displayName;
            adminUser.email = adUser.email;
            adminUser.lastLoginDate = new Date();
            adminUser.updateBy = 'AD_LOGIN';
            await repo.save(adminUser);
        }
    }

    const token = signAdminSession({
        username: resolvedUsername,
        role,
    });

    return {
        success: true,
        message: 'Login สำเร็จ',
        data: {
            token,
            username: resolvedUsername,
            displayName: adUser.displayName,
            role,
        }
    };
};

module.exports = { loginWithAD };
