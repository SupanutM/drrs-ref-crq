const { AppDataSource } = require('../../config/database');

// Health check: บอกว่า API ยังตอบได้ และต่อ database ได้ไหม
// ใช้ตรวจสอบสถานะระบบ (เช่น monitor / load balancer) โดยไม่แตะข้อมูลลูกค้า
const healthCheckController = async (req, res) => {
    const health = {
        status: true,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        database: 'unknown',
    };

    try {
        // เช็คว่า database ต่ออยู่จริง ด้วย query เบาๆ ที่ไม่แตะข้อมูล
        if (AppDataSource.isInitialized) {
            await AppDataSource.query('SELECT 1');
            health.database = 'up';
        } else {
            health.database = 'down';
        }
    } catch (error) {
        health.database = 'down';
    }

    // ถ้า database ล่ม ให้ตอบ 503 เพื่อให้ตัว monitor รู้ว่าระบบไม่พร้อม
    if (health.database !== 'up') {
        health.status = false;
        return res.status(503).json(health);
    }

    return res.status(200).json(health);
};

module.exports = { healthCheckController };
