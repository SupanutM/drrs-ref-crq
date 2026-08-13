SELECT tmmp.code AS "planCode"
	, tmmp."desc" AS "planName"
	, tmmpd."desc" AS "planDetail"
FROM drrs.tbl_mt_master_plan tmmp 
JOIN drrs.tbl_mt_master_plan_detail tmmpd ON tmmp.code = tmmpd.plan_code 
											AND tmmp.status = tmmpd.status 
WHERE tmmp.code LIKE $1