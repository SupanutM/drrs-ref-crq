SELECT
    ct.net_income                       AS "netIncome"
    , act.min_amount                    AS "minAmount"
    , COALESCE(mmp.is_check_income, '1') AS "isCheckIncome"
FROM drrs.tbl_cus_target ct
JOIN drrs.tbl_account_cus_target act
    ON  act.cus_target_id = ct.id
    AND act.account_no    = $2
    AND act.plan_no       = $3
    AND act.status        = '1'
LEFT JOIN drrs.tbl_mt_master_plan mmp
    ON  mmp.code   = act.plan_no
    AND mmp.status = '1'
WHERE ct.id = $1;
