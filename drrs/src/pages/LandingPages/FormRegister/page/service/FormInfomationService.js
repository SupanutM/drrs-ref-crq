// นำเข้า API และ Utility ทั้งหมดที่ต้องใช้ในการคุยกับหลังบ้าน
import { verifyLaserId } from "api/verify";
// import { findCustTargetByCitizenIdAndCifNo } from "api/master";
// import { addRegister, checkDupEarthQuake, exportCidToDebtTracking } from "api/register";
import { encryptGCM } from "api/crypto";

/**
 * 1. ฟังก์ชันตรวจสอบการลงทะเบียนซ้ำ (ใช้ได้ทั้งบุคคลธรรมดาและนิติบุคคล)
 * @param {string} citizenId - เลขบัตรประชาชน หรือ เลขนิติบุคคล
 */
/* export const checkDuplicateUser = async (citizenId) => {
    try {
        // Service ทำหน้าที่เข้ารหัสให้เรียบร้อย
        const checkCitizenIdEncrypted = await encryptGCM({ value: citizenId });

        // ยิง API เช็คซ้ำ
        const payload = { citizenId: checkCitizenIdEncrypted.encrypted };
        const resCheckDup = await checkDupEarthQuake(payload);

        // คืนค่าผลลัพธ์กลับไปให้ Controller ตัดสินใจต่อ
        return resCheckDup;
    } catch (error) {
        console.error("Service Error (checkDuplicateUser):", error);
        throw error; // โยน Error กลับไปให้ Controller เผื่อใช้แสดง Alert
    }
}; */

/**
 * 2. ฟังก์ชันตรวจสอบสถานะบัตรกับกรมการปกครอง (DOPA) (เฉพาะบุคคลธรรมดา)
 * @param {Object} data - ก้อนข้อมูลส่วนตัว (เลขบัตร, ชื่อ, นามสกุล, วันเกิด, เลขหลังบัตร)
 */
export const verifyCitizenCard = async ({ digitNo, citizenId, name, surname, dateOfBirth, laserCardId, email, birthDateType, telNo }) => {
    try {
        // Service จัดการเรื่องความปลอดภัย (เข้ารหัส) ทั้งหมด
        const citizenIdEncrypted = await encryptGCM({ value: citizenId });
        const laserCardIdEncrypted = await encryptGCM({ value: laserCardId });
        const nameEncrypted = await encryptGCM({ value: name });
        const surnameEncrypted = await encryptGCM({ value: surname });
        const emailEncrypted = email ? await encryptGCM({ value: email }) : { encrypted: "" };
        const telNoEncrypted = await encryptGCM({ value: telNo });

        // จัดฟอร์แมตวันเกิดให้อยู่ในรูป YYYYMMDD ตามที่ API ต้องการ
        const formattedDob = dateOfBirth.split("-").join("");

        const payload = {
            citizenId: citizenIdEncrypted.encrypted,
            name: nameEncrypted.encrypted,
            surname: surnameEncrypted.encrypted,
            dateOfBirth: formattedDob,
            laserCardId: laserCardIdEncrypted.encrypted,
            verifyCode: digitNo,
            email: emailEncrypted.encrypted,
            telNo: telNoEncrypted.encrypted,
            birthDateType: birthDateType || ""
        };

        const resVerify = await verifyLaserId(payload);
        return resVerify;
    } catch (error) {
        console.error("Service Error (verifyCitizenCard):", error);
        throw error;
    }
};

/**
 * 3. ฟังก์ชันค้นหาข้อมูลบัญชีเป้าหมาย (Customer Target)
 * @param {string} citizenId - เลขบัตร
 * @param {string} digitNo - ตัวเลข 4 หลักท้าย
 */
// export const checkCustomerTarget = async (citizenId, digitNo) => {
//     try {
//         const citizenIdEncrypted = await encryptGCM({ value: citizenId });

//         const payload = {
//             citizenId: citizenIdEncrypted.encrypted,
//             digitNo: digitNo,
//         };

//         const resTarget = await findCustTargetByCitizenIdAndCifNo(payload);
//         return resTarget;
//     } catch (error) {
//         console.error("Service Error (checkCustomerTarget):", error);
//         throw error;
//     }
// };

/**
 * 4. ฟังก์ชันบันทึกข้อมูลลงทะเบียน (ครอบคลุมการวนลูปส่งข้อมูลทุกบัญชี)
 * @param {Object} rawData - ข้อมูลดิบทั้งหมดจากหน้าจอที่ Controller ส่งมาให้
 * @param {Array} targetList - รายการบัญชี (data_list) ที่ได้จากขั้นตอน checkCustomerTarget
 */
/* export const submitRegistration = async (rawData, targetList) => {
    try {
        // เข้ารหัสข้อมูลทั่วไป
        const citizenIdEncrypted = await encryptGCM({ value: rawData.citizenId });
        const laserCardIdEncrypted = await encryptGCM({ value: rawData.laserCardId || "-" });
        const nameEncrypted = await encryptGCM({ value: rawData.name });
        const surnameEncrypted = await encryptGCM({ value: rawData.surname || "-" });
        const telNoEncrypted = await encryptGCM({ value: rawData.telNo });

        let isAllSuccess = true;
        let lastMessage = "";
        let cidRegList = [];
        let accountListStr = "";

        // วนลูปยิง API บันทึกข้อมูลตามจำนวนบัญชีที่เจอ
        for (let index = 0; index < targetList.length; index++) {
            const target = targetList[index];

            // ต่อ String เลขบัญชีแบบเซ็นเซอร์ (xxxx) ไว้โชว์หน้า Result
            const maskedAccount = `${target.account_no.substring(0, 4)}xxxx${target.account_no.substring(8)}`;
            accountListStr += index === 0 ? maskedAccount : `, ${maskedAccount}`;

            const payload = {
                citizenId: citizenIdEncrypted.encrypted,
                laserCardId: laserCardIdEncrypted.encrypted,
                cifNo: target.cif_no,
                accountNo: target.account_no,
                name: nameEncrypted.encrypted,
                surname: surnameEncrypted.encrypted,
                dateOfBirth: rawData.dateOfBirth || "-",
                telNo: telNoEncrypted.encrypted,
                homeNo: rawData.homeNo,
                road: rawData.road,
                subDistrict: rawData.subDistrict,
                district: rawData.district,
                province: rawData.province,
                postCode: rawData.postCode,
                isCustTarget: true,
                debtRepaymentCode: targetList[0].debt_repayment_code,
            };

            const resAdd = await addRegister(payload);

            if (!resAdd.status_flag) {
                isAllSuccess = false;
                lastMessage = resAdd.status_message;
            }
            cidRegList.push({ cid: target.account_no });
        }

        // ถ้ายิง AddRegister ผ่านทั้งหมด ให้ยิง Export ต่อ
        if (isAllSuccess) {
            const resExport = await exportCidToDebtTracking({ cidRegList });
            return {
                status: resExport.status_flag,
                message: resExport.status_message,
                accountListStr: accountListStr // ส่งกลับไปให้ Controller เอาไปใช้ต่อ
            };
        } else {
            return { status: false, message: lastMessage };
        }

    } catch (error) {
        console.error("Service Error (submitRegistration):", error);
        throw error;
    }
}; */