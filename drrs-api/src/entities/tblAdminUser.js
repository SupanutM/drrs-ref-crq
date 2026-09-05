const { EntitySchema } = require("typeorm");

/**
 * ผู้ใช้งานฝั่ง admin — ยืนยันตัวตนผ่าน Active Directory (AD) ไม่มี password เก็บในตารางนี้
 * แถวจะถูกสร้าง/อัปเดตอัตโนมัติตอน login AD สำเร็จครั้งแรก (upsert ตาม username)
 * ใช้เก็บ role/สิทธิ์และ audit ว่าใครเคย login เข้าระบบ admin บ้าง
 * ตาราง: drrs.tbl_admin_user
 */
const tblAdminUser = new EntitySchema({
    name: "tbl_admin_user",
    tableName: "tbl_admin_user",
    columns: {
        id: {
            primary: true,
            type: "int",
            generated: true
        },
        username: {
            name: "username",
            type: "varchar",
            length: 50,
            unique: true,
            nullable: false
        },
        displayName: {
            name: "display_name",
            type: "varchar",
            length: 100,
            nullable: true
        },
        email: {
            name: "email",
            type: "varchar",
            length: 100,
            nullable: true
        },
        // สิทธิ์การใช้งาน admin — เก็บได้ 3 ค่าเท่านั้น: 'SUPERADMIN', 'ADMIN', หรือค่าว่าง (NULL)
        // เป็นสิทธิ์แบบลำดับชั้น (hierarchy) — สิทธิ์สูงกว่าทำสิ่งที่สิทธิ์ต่ำกว่าทำได้เสมอ:
        //   NULL       = ผู้ใช้ทั่วไป (login ผ่าน AD ได้ แต่ทำได้แค่ reprint สัญญา)
        //   'ADMIN'    = ผู้ใช้ทั่วไป + import master/target data ได้
        //   'SUPERADMIN' = ADMIN ทุกอย่าง + จัดการสิทธิ์ผู้ใช้ admin คนอื่นได้ (หน้า user-management)
        // ไม่มีการ auto-grant จากระบบเลยไม่ว่ากรณีใด (แม้ login AD สำเร็จครั้งแรกก็ตาม) —
        // ต้องมีคนกำหนดผ่าน SQL ตรงๆ ก่อน (ดู sql/create_tbl_admin_user.sql) หรือผ่านหน้า
        // user-management (ต้องมี SUPERADMIN คนแรกอยู่แล้วถึงจะเข้าหน้านั้นได้)
        role: {
            name: "role",
            type: "varchar",
            length: 20,
            nullable: true,
        },
        status: {
            name: "status",
            type: "character", // bpchar — '1' = ใช้งานได้, '0' = ถูกระงับ
            length: 1,
            nullable: false,
            default: '1'
        },
        lastLoginDate: {
            name: "last_login_date",
            type: "timestamp with time zone",
            nullable: true
        },
        createdDate: {
            name: "created_date",
            type: "timestamp with time zone",
            createDate: true,
            default: () => "CURRENT_TIMESTAMP"
        },
        createdBy: {
            name: "created_by",
            type: "varchar",
            length: 20,
            default: "DRRS"
        },
        updateDate: {
            name: "update_date",
            type: "timestamp with time zone",
            nullable: true,
            updateDate: true
        },
        updateBy: {
            name: "update_by",
            type: "varchar",
            length: 20,
            nullable: true
        },
        deleteDate: {
            name: "delete_date",
            type: "timestamp with time zone",
            nullable: true
        },
        deleteBy: {
            name: "delete_by",
            type: "varchar",
            length: 20,
            nullable: true
        }
    }
});

module.exports = tblAdminUser;
