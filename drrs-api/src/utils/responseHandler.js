const sendSuccess = (res, message = 'ดำเนินการสำเร็จ', data = null, template = null, statusCode = 200) => {
    return res.status(statusCode).json({
        success: true,
        message: message,
        data: data,
        template: template
    });
};

const sendError = (res, message = 'เกิดข้อผิดพลาดในระบบ', statusCode = 500, errorDetails = null) => {
    const response = {
        success: false,
        message: message
    };

    // ส่งรายละเอียด Error เพิ่มเติมเฉพาะช่วง Development (ถ้ามี)
    if (errorDetails && process.env.NODE_ENV !== 'production') {
        response.error = errorDetails.message || errorDetails;
    }

    return res.status(statusCode).json(response);
};

const sendPagination = (res, message = 'ดึงข้อมูลสำเร็จ', data = [], total = 0, page = 1, limit = 10) => {
    const totalPages = Math.ceil(total / limit);
    
    return res.status(200).json({
        success: true,
        message: message,
        data: data,
        pagination: {
            totalItems: total,
            totalPages: totalPages,
            currentPage: Number(page),
            itemCount: data.length,
            limit: Number(limit)
        }
    });
};

module.exports = {
    sendSuccess,
    sendError,
    sendPagination
};