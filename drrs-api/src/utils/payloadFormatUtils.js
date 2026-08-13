const { create } = require("axios");

const payloadFormat = (payload) => {
    // เช็คกันเหนียวเผื่อไม่ได้ส่งอะไรมา
    if (!payload || typeof payload !== 'object') {
        return { status: "1", createdDate: new Date(), createdBy: "DRRS" };
    }

    return {
        ...payload,      
        status: payload.status ? payload.status : "1",             
        createdDate: new Date(),       
        createdBy: "DRRS"
    };
};

module.exports = {
    payloadFormat
};