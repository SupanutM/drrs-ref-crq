const { checkCloseSystemService } = require('../../services/util/checkCloseSystem');

const checkCloseSystemController = async (req, res) => {
    try {
        const { channel } = req.body;

        // ดักเคสหน้าบ้านลืมส่ง planNo
        if (!channel) {
            return res.status(400).json({ 
                status: false, 
                message: "Bad Request: กรุณาระบุ channel code" 
            });
        }

        const result = await checkCloseSystemService(channel);

        // คืนค่ากลับไปให้หน้าบ้าน (HTTP 200 OK)
        return res.status(200).json(result);

    } catch (error) {
        // กรณีระบบมีปัญหา (HTTP 500 Internal Server Error)
        return res.status(500).json({ 
            status: false, 
            message: error.message 
        });
    }
};

module.exports = { checkCloseSystemController };