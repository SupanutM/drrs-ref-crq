SELECT COUNT(*) as count 
FROM drrs.tbl_account_installment tai
WHERE tai.account_no LIKE $1 
	AND tai.status LIKE '1'