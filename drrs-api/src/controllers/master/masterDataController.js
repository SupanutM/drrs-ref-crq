const MasterDataService = require("../../services/master/masterDataService");

const getProvinces = async (req, res) => {
    try {
        const provinces = await MasterDataService.getProvinces();
        return res.status(200).json({
            success: true,
            data: provinces
        });
    } catch (error) {
        console.error("Error fetching provinces:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getDistricts = async (req, res) => {
    try {
        const { provinceCode } = req.params;
        if (!provinceCode) {
            return res.status(400).json({ success: false, message: "provinceCode is required" });
        }
        const districts = await MasterDataService.getDistricts(provinceCode);
        return res.status(200).json({
            success: true,
            data: districts
        });
    } catch (error) {
        console.error("Error fetching districts:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

const getSubDistricts = async (req, res) => {
    try {
        const { provinceCode, districtCode } = req.params;
        if (!provinceCode || !districtCode) {
            return res.status(400).json({ success: false, message: "provinceCode and districtCode are required" });
        }
        const subDistricts = await MasterDataService.getSubDistricts(provinceCode, districtCode);
        return res.status(200).json({
            success: true,
            data: subDistricts
        });
    } catch (error) {
        console.error("Error fetching sub-districts:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

module.exports = {
    getProvinces,
    getDistricts,
    getSubDistricts
};
