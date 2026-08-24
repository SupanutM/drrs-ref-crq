const express = require("express");
const router = express.Router();
const masterDataController = require("../controllers/master/masterDataController");

router.get("/master/provinces", masterDataController.getProvinces);
router.get("/master/districts/:provinceCode", masterDataController.getDistricts);
router.get("/master/sub-districts/:provinceCode/:districtCode", masterDataController.getSubDistricts);

module.exports = router;
