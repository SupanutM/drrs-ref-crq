SELECT tct.account_no AS "accountNo"
	, concat(tct.first_name , ' ', tct.last_name ) AS "fullName"
	, tahc.plan_no AS "planNo"
	, tahc.created_date::DATE AS "regisDate"
FROM drrs.tbl_account_hair_cut tahc  
JOIN drrs.tbl_cus_target tct ON tahc.account_no = tct.account_no 
                                AND tct.status = '1'
WHERE tahc.account_no LIKE $1
	AND tahc.status LIKE '1';