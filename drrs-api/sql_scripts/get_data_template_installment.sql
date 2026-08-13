SELECT tct.account_no AS "accountNo"
	, concat(tct.first_name , ' ', tct.last_name ) AS "fullName"
	, tai.plan_no AS "planNo"
	, tai.created_date::DATE AS "regisDate"
FROM drrs.tbl_account_installment tai 
JOIN drrs.tbl_cus_target tct ON tai.account_no = tct.account_no 
                                AND tct.status = '1'
WHERE tai.account_no LIKE $1
	AND tai.status LIKE '1';