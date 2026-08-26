/**
 * Global teardown ของชุดเทสต์ที่ยิง backend จริง
 *
 * คืนค่าตารางที่ flow ไปเขียนทับ ให้กลับเป็นเหมือนก่อนรันเทสต์ แล้วลบ schema สำรองทิ้ง
 * ถ้าคืนค่าไม่สำเร็จ จะไม่ลบ schema สำรอง เพื่อให้กู้ด้วยมือได้
 */
const { BACKUP_SCHEMA, connect, restoreMutableState } = require("./helpers/db");

module.exports = async () => {
  try {
    await restoreMutableState();
    console.log("[e2e-real] คืนค่าข้อมูล DB กลับเป็นเหมือนก่อนรันเทสต์แล้ว");
  } catch (err) {
    console.error(
      `[e2e-real] คืนค่าข้อมูลไม่สำเร็จ: ${err.message}\n` +
        `ข้อมูลสำรองยังอยู่ที่ schema ${BACKUP_SCHEMA} — คืนค่าด้วยมือได้`
    );
    throw err;
  }

  const client = await connect();
  try {
    await client.query(`DROP SCHEMA IF EXISTS ${BACKUP_SCHEMA} CASCADE`);
  } finally {
    await client.end();
  }
};
