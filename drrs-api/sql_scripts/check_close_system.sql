SELECT tsa.status_flag 
	, tsa.app_version AS "appVersion"
FROM drrs.tbl_settings_app tsa 
WHERE tsa.channel LIKE $1
	AND tsa.status LIKE '1'