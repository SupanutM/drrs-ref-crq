SELECT COUNT(*) as count 
FROM drrs.tbl_account_hair_cut tahc 
WHERE tahc.account_no LIKE $1 
	AND tahc.status LIKE '1'