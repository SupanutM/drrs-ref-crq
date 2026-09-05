import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { useNavigate } from "react-router-dom";

import { getAdminToken, getAdminProfile } from "utils/adminAuthToken";

// สิทธิ์แบบลำดับชั้น — SUPERADMIN ทำทุกอย่างที่ ADMIN ทำได้ (ดู comment ใน
// drrs-api/src/entities/tblAdminUser.js) จึงต้องอยู่ใน allowlist ของ requireAdmin ด้วย
const ADMIN_OR_HIGHER_ROLES = ["ADMIN", "SUPERADMIN"];

/**
 * AdminGuard
 * ครอบหน้า admin ทุกหน้า (ยกเว้นหน้า login) — ถ้าไม่มี admin token เลย ให้เด้งไปหน้า login ทันที
 * ไม่ต้องมี idle timeout dialog แบบ SessionGuard ของฝั่งลูกค้า เพราะ admin token มีอายุยาวกว่า
 * (480 นาที ตาม JWT_ADMIN_EXPIRES_IN) และเป็นผู้ใช้งานภายในองค์กร ไม่ใช่ประชาชนทั่วไป
 * การหมดอายุจริง (401 จาก backend) ถูกจัดการที่ adminHandler.js interceptor อยู่แล้ว (ล้าง token ทิ้ง)
 *
 * ถ้าส่ง requireAdmin={true} — บังคับว่า role ต้องเป็น 'ADMIN' หรือ 'SUPERADMIN' (ใช้กับหน้านำเข้าข้อมูล)
 * ถ้าส่ง requireSuperAdmin={true} — บังคับว่า role ต้องเป็น 'SUPERADMIN' เท่านั้น (ใช้กับหน้าจัดการ
 * สิทธิ์ผู้ใช้ admin — ADMIN ธรรมดาเข้าไม่ได้ กันตั้งสิทธิ์ให้ตัวเอง/คนอื่นเอง)
 * ผู้ใช้ที่สิทธิ์ไม่พอที่พิมพ์ URL ตรงเข้ามาจะถูกเด้งไปหน้า reprint สัญญาแทน (กัน bypass การซ่อนปุ่ม
 * ใน navbar ด้วยการพิมพ์ URL เอง — ฝั่ง backend ก็เช็ค role ซ้ำอีกชั้นอยู่แล้วที่ middleware)
 */
function AdminGuard({ children, requireAdmin, requireSuperAdmin }) {
  const navigate = useNavigate();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const token = getAdminToken();
    if (!token) {
      navigate("/drrs/admin/login", { replace: true });
      return;
    }

    const profile = getAdminProfile();

    if (requireSuperAdmin && profile?.role !== "SUPERADMIN") {
      navigate("/drrs/admin/contract-reprint", { replace: true });
      return;
    }

    if (requireAdmin && !ADMIN_OR_HIGHER_ROLES.includes(profile?.role)) {
      navigate("/drrs/admin/contract-reprint", { replace: true });
      return;
    }

    setChecked(true);
  }, [navigate, requireAdmin, requireSuperAdmin]);

  if (!checked) {
    return null;
  }

  return <>{children}</>;
}

AdminGuard.defaultProps = {
  requireAdmin: false,
  requireSuperAdmin: false,
};

AdminGuard.propTypes = {
  children: PropTypes.node.isRequired,
  requireAdmin: PropTypes.bool,
  requireSuperAdmin: PropTypes.bool,
};

export default AdminGuard;
