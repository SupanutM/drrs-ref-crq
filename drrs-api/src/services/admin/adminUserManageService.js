const { ILike } = require('typeorm');
const { AppDataSource } = require('../../config/database');
const tblAdminUser = require('../../entities/tblAdminUser');
const baseLogger = require('../../utils/logger');
const logger = baseLogger.child({ context: 'adminUserManageService' });

// role ที่จัดการผ่านหน้านี้ได้มีแค่ 2 ระดับนี้เท่านั้น (ทั้งตอนเพิ่มใหม่และแก้ไขที่มีอยู่แล้ว) —
// ผู้ใช้ทั่วไป (role=NULL) ไม่เก็บแถวลงตารางนี้เลย (ดู comment ใน entities/tblAdminUser.js) จึงไม่มี
// เหตุผลให้ตั้ง role เป็นค่าว่างผ่าน endpoint พวกนี้ ถ้าต้องการเพิกถอนสิทธิ์ทั้งหมดให้ระงับบัญชีแทน
const ADD_ALLOWED_ROLES = ['SUPERADMIN', 'ADMIN'];

const sanitizeUsername = (username) => String(username || '').trim();

/**
 * ดึงรายชื่อผู้ใช้ admin ทั้งหมด (ไม่รวมแถวที่ soft-delete ไปแล้ว) เรียงตาม username
 * รองรับค้นหา/กรองแบบไม่บังคับ:
 *   - keyword: ค้นแบบ contains (ไม่สนตัวพิมพ์เล็ก/ใหญ่) กับ username, display_name, email
 *   - role: กรอง role ตรงตัว ('ADMIN' | 'SUPERADMIN' | '' สำหรับผู้ใช้ทั่วไป/role เป็น NULL)
 *   - status: กรอง status ตรงตัว ('1' | '0')
 */
const listAdminUsers = async ({ keyword, role, status } = {}) => {
    const repo = AppDataSource.getRepository(tblAdminUser);
    const qb = repo.createQueryBuilder('u').where('u.delete_date IS NULL');

    const cleanKeyword = String(keyword || '').trim();
    if (cleanKeyword) {
        qb.andWhere(
            '(u.username ILIKE :keyword OR u.display_name ILIKE :keyword OR u.email ILIKE :keyword)',
            { keyword: `%${cleanKeyword}%` }
        );
    }

    // role ส่งมาเป็น '' หมายถึง "ผู้ใช้ทั่วไป" (role เป็น NULL ใน DB) แยกจาก undefined (ไม่กรอง role เลย)
    if (role !== undefined) {
        if (role === '' || role === null) {
            qb.andWhere('u.role IS NULL');
        } else {
            qb.andWhere('u.role = :role', { role });
        }
    }

    if (status !== undefined && status !== '') {
        qb.andWhere('u.status = :status', { status });
    }

    const users = await qb.orderBy('u.username', 'ASC').getMany();

    return { success: true, data: users };
};

/**
 * เพิ่มผู้ใช้ admin ใหม่เข้า whitelist — ใช้เผื่อกรณีต้องให้สิทธิ์ ADMIN ล่วงหน้า
 * ก่อนที่ user คนนั้นจะ login AD ครั้งแรก (ปกติแถวใน tbl_admin_user จะถูกสร้าง/sync ตอน login
 * เท่านั้น แต่ตอน login ครั้งแรกจะยังไม่มีแถวให้ผู้ใช้ทั่วไปเลย ต้องมาเพิ่มเองผ่านหน้านี้)
 * username ต้องไม่ซ้ำกับที่มีอยู่แล้ว (unique constraint ในตาราง)
 */
const addAdminUser = async ({ username, displayName, email, role }, actorUsername) => {
    const cleanUsername = sanitizeUsername(username);
    if (!cleanUsername) {
        return { success: false, statusCode: 400, message: 'กรุณาระบุ username' };
    }
    // ผู้ใช้ทั่วไป (role=NULL) ไม่เก็บแถวลงตารางนี้เลย (ดู comment ใน entities/tblAdminUser.js)
    // เพิ่มผู้ใช้ผ่านหน้านี้ได้แค่ระดับ ADMIN/SUPERADMIN เท่านั้น ไม่รับ role ว่าง/NULL อีกต่อไป
    const cleanRole = role || null;
    if (!ADD_ALLOWED_ROLES.includes(cleanRole)) {
        return { success: false, statusCode: 400, message: 'role ไม่ถูกต้อง (ต้องเป็น SUPERADMIN หรือ ADMIN เท่านั้น)' };
    }

    const repo = AppDataSource.getRepository(tblAdminUser);
    // เช็คซ้ำแบบไม่สนตัวพิมพ์เล็ก/ใหญ่ — AD มองว่า "SupanutM"/"supanutm" เป็นคนเดียวกัน (bind
    // ผ่านได้ทั้งคู่) ถ้าเช็ค exact match ตรงๆ จะเพิ่มซ้ำเป็น 2 แถวที่จริงคือคนเดียวกันได้
    const existing = await repo.findOne({ where: { username: ILike(cleanUsername) } });
    if (existing) {
        return { success: false, statusCode: 409, message: `username "${cleanUsername}" มีอยู่ในระบบแล้ว (${existing.username})` };
    }

    const newUser = repo.create({
        username: cleanUsername,
        displayName: displayName || null,
        email: email || null,
        role: cleanRole,
        status: '1',
        createdBy: actorUsername,
    });
    const saved = await repo.save(newUser);

    logger.info(`เพิ่มผู้ใช้ admin ใหม่: username=${cleanUsername} role=${cleanRole || 'null'} โดย=${actorUsername}`);
    return { success: true, message: 'เพิ่มผู้ใช้สำเร็จ', data: saved };
};

/**
 * นับจำนวน SUPERADMIN ที่ยังใช้งานได้ในระบบ (ไม่ถูก soft-delete, status='1')
 * ใช้กันเคส "ไม่มีใครจัดการสิทธิ์ได้เลย" — ถ้าเหลือคนเดียว ห้ามถอดสิทธิ์/ระงับคนนั้น
 */
const countActiveSuperAdmins = async (repo) => {
    return repo.count({ where: { role: 'SUPERADMIN', status: '1' } });
};

/**
 * แก้ไข role และ/หรือ status ของผู้ใช้ admin ที่มีอยู่แล้ว
 * กันเคส "ล็อกตัวเองออกจากระบบ" — ห้ามถอดสิทธิ์ SUPERADMIN/ระงับบัญชีของตัวเอง
 * (ต้องให้ SUPERADMIN คนอื่นเป็นคนทำแทนเสมอ)
 * กันเคส "ไม่มีใครจัดการสิทธิ์ได้เลยทั้งระบบ" — ห้ามถอดสิทธิ์/ระงับ SUPERADMIN คนสุดท้าย
 */
const updateAdminUser = async (id, { role, status }, actorUsername) => {
    if (!Number.isFinite(id)) {
        return { success: false, statusCode: 400, message: 'id ไม่ถูกต้อง' };
    }

    const repo = AppDataSource.getRepository(tblAdminUser);
    const user = await repo.findOne({ where: { id } });
    if (!user || user.deleteDate) {
        return { success: false, statusCode: 404, message: 'ไม่พบผู้ใช้ที่ต้องการแก้ไข' };
    }

    const isSelf = user.username === actorUsername;
    if (isSelf && role !== undefined && role !== 'SUPERADMIN') {
        return { success: false, statusCode: 400, message: 'ไม่สามารถถอดสิทธิ์ SUPERADMIN ของตัวเองได้ (กันล็อกตัวเองออกจากระบบ)' };
    }
    if (isSelf && status !== undefined && status !== '1') {
        return { success: false, statusCode: 400, message: 'ไม่สามารถระงับบัญชีของตัวเองได้' };
    }

    // กัน SUPERADMIN คนสุดท้ายของระบบถูกถอดสิทธิ์/ระงับ (ไม่ว่าจะเป็นคนอื่นทำหรือตัวเองทำ)
    // เช็คก่อนแก้ไขจริง — ต้องยังเป็น SUPERADMIN + status='1' อยู่ตอนนี้ถึงจะเข้าเงื่อนไขนี้
    const willLoseRole = user.role === 'SUPERADMIN' && role !== undefined && role !== 'SUPERADMIN';
    const willLoseStatus = user.role === 'SUPERADMIN' && user.status === '1' && status !== undefined && status !== '1';
    if (willLoseRole || willLoseStatus) {
        const activeSuperAdmins = await countActiveSuperAdmins(repo);
        if (activeSuperAdmins <= 1) {
            return {
                success: false,
                statusCode: 400,
                message: 'ไม่สามารถถอดสิทธิ์/ระงับผู้ใช้รายนี้ได้ เนื่องจากเป็น SUPERADMIN คนสุดท้ายของระบบ (ต้องมี SUPERADMIN อย่างน้อย 1 คนเสมอ)',
            };
        }
    }

    if (role !== undefined) {
        // แก้ role ของแถวที่มีอยู่แล้วก็ทำได้แค่ ADMIN/SUPERADMIN เช่นกัน — ห้ามลดเป็น NULL
        // ("ผู้ใช้ทั่วไป") ผ่านหน้านี้ ถ้าต้องการเพิกถอนสิทธิ์ทั้งหมดให้ระงับบัญชี (status='0') แทน
        // ไม่งั้นแถวนั้นจะกลายเป็นผู้ใช้ทั่วไปที่ยัง "มีแถวอยู่" ในตาราง ขัดกับที่ตกลงไว้ว่าไม่เก็บ
        const cleanRole = role || null;
        if (!ADD_ALLOWED_ROLES.includes(cleanRole)) {
            return { success: false, statusCode: 400, message: 'role ไม่ถูกต้อง (ต้องเป็น SUPERADMIN หรือ ADMIN เท่านั้น — ถ้าต้องการเพิกถอนสิทธิ์ให้ใช้ระงับบัญชีแทน)' };
        }
        user.role = cleanRole;
    }
    if (status !== undefined) {
        if (status !== '1' && status !== '0') {
            return { success: false, statusCode: 400, message: 'status ไม่ถูกต้อง (ต้องเป็น "1" หรือ "0")' };
        }
        user.status = status;
    }

    user.updateBy = actorUsername;
    user.updateDate = new Date();
    const saved = await repo.save(user);

    logger.info(`แก้ไขผู้ใช้ admin: id=${id} username=${user.username} role=${user.role || 'null'} status=${user.status} โดย=${actorUsername}`);
    return { success: true, message: 'แก้ไขข้อมูลสำเร็จ', data: saved };
};

module.exports = { listAdminUsers, addAdminUser, updateAdminUser };
