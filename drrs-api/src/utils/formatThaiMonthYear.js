const formatThaiMonthYear = (timestamp) => {
    // 1. ตรวจสอบว่ามีค่าส่งมาหรือไม่ ถ้าไม่มีให้คืนค่าว่าง
    if (!timestamp) return { month: "", year: "" };

    const date = new Date(timestamp);

    // 2. ตรวจสอบว่าวันที่แปลงมาถูกต้องหรือไม่ (ป้องกันค่า Invalid Date)
    if (isNaN(date.getTime())) return { month: "", year: "" };

    // 3. เตรียมชื่อเดือนภาษาไทย
    const thaiMonths = [
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม"
    ];

    // 4. แกะค่าเดือน (0-11) และปี (แปลงเป็น พ.ศ.)
    const monthName = thaiMonths[date.getMonth()];
    const yearBE = (date.getFullYear() + 543).toString();

    return { 
        month: monthName, 
        year: yearBE 
    };
};

module.exports = { 
    formatThaiMonthYear 
};