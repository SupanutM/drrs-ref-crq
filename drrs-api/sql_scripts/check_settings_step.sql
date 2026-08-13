SELECT tss.account_no AS "accountNo"
	, tss.step_confirm_plan AS "stepConfirmPlan"
    , tss.step_send_to_cbs AS "stepSendToCbs"
    , tss.step_verify_target AS "stepVerifyTarget"
    , tss.step_verify_laser AS "stepVerifyLaser"
    , tss.step_view_plan AS "stepViewPlan"
    , tss.step_send_mail AS "stepSendMail"
FROM drrs.tbl_settings_step tss
WHERE account_no = $1;