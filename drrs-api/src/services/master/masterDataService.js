const { AppDataSource } = require("../../config/database");
const tblMtProvince = require("../../entities/tblMtProvince");
const tblMtDistrict = require("../../entities/tblMtDistrict");
const tblMtSubDistrict = require("../../entities/tblMtSubDistrict");

class MasterDataService {
    static async getProvinces() {
        const repo = AppDataSource.getRepository(tblMtProvince);
        const data = await repo.find({
            where: { status: '1', lang: 'TH' },
            order: { provinceName: "ASC" }
        });
        return data;
    }

    static async getDistricts(provinceCode) {
        const repo = AppDataSource.getRepository(tblMtDistrict);
        const data = await repo.find({
            where: { 
                provinceCode: provinceCode,
                status: '1',
                lang: 'TH'
            },
            order: { districtName: "ASC" }
        });
        return data;
    }

    static async getSubDistricts(provinceCode, districtCode) {
        const repo = AppDataSource.getRepository(tblMtSubDistrict);
        const data = await repo.find({
            where: { 
                provinceCode: provinceCode,
                districtCode: districtCode,
                status: '1',
                lang: 'TH'
            },
            order: { subDistrictName: "ASC" }
        });
        return data;
    }
}

module.exports = MasterDataService;
