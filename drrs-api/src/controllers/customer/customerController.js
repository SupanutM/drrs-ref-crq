const axios = require('axios');
const https = require('https');
const crypto = require('crypto');
const logger = require('../../utils/logger');
const { AppDataSource } = require('../../config/database');
const tblCusTarget = require('../../entities/tblCusTarget');

const lookupCustomer = async (req, res) => {
    try {
        // cusTargetId มาจาก session token (req.auth) ไม่เชื่อค่าจาก body (กัน IDOR)
        const cusTargetId = req.auth?.cusTargetId;

        if (!cusTargetId) {
            return res.status(401).json({ success: false, message: "unauthorized" });
        }

        const cusTargetRepo = AppDataSource.getRepository(tblCusTarget);
        const cusTarget = await cusTargetRepo.findOne({ where: { id: cusTargetId } });

        if (!cusTarget) {
            return res.status(404).json({ success: false, message: "Customer target not found in database" });
        }

        const citizen_id = cusTarget.citizenId;
        const customer_number = cusTarget.cifNo || "";

        // URL ดึงจาก Environment Variable หรือใช้ Hardcode ชั่วคราว (อ้างอิงจากที่ user ให้มา)
        const CUST_API_BASE_URL = process.env.CUST_API_BASE_URL;
        const url = `${CUST_API_BASE_URL}/customer-management/v1/customers/lookup`;

        const headers = {
            "x-job-id": crypto.randomUUID(),
            "x-channel": "IB",
            "x-request-id": crypto.randomUUID(),
            "Content-Type": "application/json",
            "branch_code": "1",
            "terminal_id": "1"
        };

        const payload = {
            "rq_body": {
                "lookup_key": {
                    "customer_number": customer_number || "",
                    "citizen_id": citizen_id || ""
                }
            }
        };

        // logger.info(`Calling CUST API for cusTargetId: ${cusTargetId}`);

        const httpsAgent = new https.Agent({
            rejectUnauthorized: false
        });

        const response = await axios.post(url, payload, { headers, httpsAgent });

        // Return back to frontend
        return res.status(200).json({
            success: true,
            data: response.data
        });

    } catch (error) {
        logger.error(`[lookupCustomer] Error calling CUST API: ${error.message}`);
        if (error.response) {
            logger.error(`[lookupCustomer] CUST API error status: ${error.response.status}`);
            return res.status(error.response.status).json({
                success: false,
                message: "ไม่สามารถดึงข้อมูลลูกค้าจากระบบได้",
                error: error.response.data
            });
        }
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

const updateCustomerAddress = async (req, res) => {
    try {
        const { address } = req.body;
        // cusTargetId มาจาก session token (req.auth) ไม่เชื่อค่าจาก body (กัน IDOR)
        const cusTargetId = req.auth?.cusTargetId;

        if (!cusTargetId) {
            return res.status(401).json({ success: false, message: "unauthorized" });
        }
        if (!address) {
            return res.status(400).json({ success: false, message: "address is required" });
        }

        const cusTargetRepo = AppDataSource.getRepository(tblCusTarget);
        const cusTarget = await cusTargetRepo.findOne({ where: { id: cusTargetId } });

        if (!cusTarget) {
            return res.status(404).json({ success: false, message: "Customer target not found in database" });
        }

        cusTarget.address = address;
        await cusTargetRepo.save(cusTarget);

        return res.status(200).json({ success: true, message: "Address updated successfully" });

    } catch (error) {
        logger.error(`[updateCustomerAddress] Error: ${error.message}`);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
            error: error.message
        });
    }
};

module.exports = {
    lookupCustomer,
    updateCustomerAddress
};
