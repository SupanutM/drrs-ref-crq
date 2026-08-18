@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1

:: ============================================================
::  CSV to PostgreSQL Importer - Multi-Table with Soft Delete
::  รองรับ:
::    PROVINCE_*.csv     -> drrs.tbl_mt_province
::    DISTRICT_*.csv     -> drrs.tbl_mt_district
::    SUB_DISTRICT_*.csv -> drrs.tbl_mt_sub_district
::  Logic:
::    1. โหลด CSV เข้า temp table
::    2. Soft delete record ที่ key ตรงกัน (status='0')
::    3. INSERT ข้อมูลใหม่
::  Fixed values:
::    status       = '1'
::    created_date = CURRENT_TIMESTAMP
::    created_by   = 'Batch_Import'
::    delete_by    = 'Batch_Import' (กรณี soft delete)
:: ============================================================

set "SCRIPT_DIR=%~dp0"
set "PSQL=D:\setup\postgresql-17.10-1-windows-x64-binaries\pgsql\bin\psql.exe"

:: ---- Connection Config ----
set "DB_HOST=localhost"
set "DB_PORT=5432"
set "DB_NAME=postgres"
set "DB_USER=loanadm"
set "PGPASSWORD=P@ssw0rd"

:: ---- Fixed Values ----
set "FIXED_STATUS=1"
set "FIXED_CREATED_BY=Batch_Import"
set "FIXED_DELETE_BY=Batch_Import"

:: ---- Delimiter ----
set "DELIMITER=,"

:: ---- Default CSV Folder ----
set "DEFAULT_FOLDER=D:\06-69\PAR69_ฝรล_612"

:: ---- Temp folder (ASCII path) ----
set "TEMP_IMPORT_DIR=%TEMP%\pg_import_tmp"

:: ---- Log File ----
set "LOG_FILE=%~dp0import_log_%date:~-4%%date:~3,2%%date:~0,2%_%time:~0,2%%time:~3,2%%time:~6,2%.txt"
set "LOG_FILE=%LOG_FILE: =0%"
set "ERROR_COUNT=0"
set "SUCCESS_COUNT=0"

call :log "========================================"
call :log " CSV to PostgreSQL Import - Started"
call :log " Time: %date% %time%"
call :log "========================================"

echo.
echo ============================================
echo   CSV to PostgreSQL Importer (Multi-Table)
echo   Mode: Soft Delete + Re-Insert
echo ============================================
echo.
echo [INFO] Host       : !DB_HOST!:!DB_PORT!
echo [INFO] Database   : !DB_NAME!
echo [INFO] User       : !DB_USER!
echo [INFO] Created by : !FIXED_CREATED_BY!
echo [INFO] Delete by  : !FIXED_DELETE_BY!
echo [INFO] Encoding   : Windows-874 to UTF-8
echo [INFO] Folder     : !DEFAULT_FOLDER!
echo.
echo [INFO] Auto-detect table:
echo         PROVINCE_*     -> drrs.tbl_mt_province
echo         DISTRICT_*     -> drrs.tbl_mt_district
echo         SUB_DISTRICT_* -> drrs.tbl_mt_sub_district
echo.

call :log "Connection: !DB_USER!@!DB_HOST!:!DB_PORT!/!DB_NAME!"

if not exist "!TEMP_IMPORT_DIR!" mkdir "!TEMP_IMPORT_DIR!"

echo ======================================
echo   เลือกรูปแบบการ Import
echo ======================================
echo   [1] Batch folder - Import CSV ทุกไฟล์ใน DEFAULT_FOLDER
echo   [2] Single file  - ระบุ path ของ CSV ไฟล์เดียว
echo   [3] Custom folder - ระบุ folder อื่น
echo.
set /p "MODE=เลือกโหมด [1-3] (default: 1): "

if "!MODE!"=="2" (
    call :mode_single
) else if "!MODE!"=="3" (
    call :mode_custom_folder
) else (
    call :mode_default_folder
)

rd /s /q "!TEMP_IMPORT_DIR!" >nul 2>&1

echo.
echo ======================================
echo   ผลการ Import
echo ======================================
echo   สำเร็จ : !SUCCESS_COUNT! ไฟล์
echo   Error  : !ERROR_COUNT! ไฟล์
echo   Log    : !LOG_FILE!
echo ======================================

call :log "========================================"
call :log " Summary: Success=!SUCCESS_COUNT! Error=!ERROR_COUNT!"
call :log "========================================"

if !ERROR_COUNT! GTR 0 (
    echo.
    echo [!] พบ !ERROR_COUNT! error -- กำลังเปิด Log file...
    start notepad "!LOG_FILE!"
)

set PGPASSWORD=
pause
exit /b 0

:: ============================================================
:mode_default_folder
if not exist "!DEFAULT_FOLDER!" (
    echo [ERROR] ไม่พบ folder: !DEFAULT_FOLDER!
    call :log "[ERROR] Folder not found: !DEFAULT_FOLDER!"
    set /a ERROR_COUNT+=1
    goto :eof
)
echo.
echo กำลังค้นหาไฟล์ .csv ใน: !DEFAULT_FOLDER!
echo.
set "FILE_COUNT=0"
for %%F in ("!DEFAULT_FOLDER!\*.csv") do (
    set /a FILE_COUNT+=1
    call :import_file "%%~fF"
)
if !FILE_COUNT! EQU 0 (
    echo [WARN] ไม่พบไฟล์ .csv ใน folder นี้
    call :log "[WARN] No CSV files found in: !DEFAULT_FOLDER!"
)
goto :eof

:: ============================================================
:mode_single
echo.
set /p "CSV_FILE=ระบุ path ของ CSV file: "
set "CSV_FILE=!CSV_FILE:"=!"
if not exist "!CSV_FILE!" (
    echo [ERROR] ไม่พบไฟล์: !CSV_FILE!
    call :log "[ERROR] File not found: !CSV_FILE!"
    set /a ERROR_COUNT+=1
    goto :eof
)
call :import_file "!CSV_FILE!"
goto :eof

:: ============================================================
:mode_custom_folder
echo.
set /p "CSV_FOLDER=ระบุ path ของ folder: "
set "CSV_FOLDER=!CSV_FOLDER:"=!"
if not exist "!CSV_FOLDER!" (
    echo [ERROR] ไม่พบ folder: !CSV_FOLDER!
    call :log "[ERROR] Folder not found: !CSV_FOLDER!"
    set /a ERROR_COUNT+=1
    goto :eof
)
echo.
echo กำลังค้นหาไฟล์ .csv ใน: !CSV_FOLDER!
echo.
set "FILE_COUNT=0"
for %%F in ("!CSV_FOLDER!\*.csv") do (
    set /a FILE_COUNT+=1
    call :import_file "%%~fF"
)
if !FILE_COUNT! EQU 0 (
    echo [WARN] ไม่พบไฟล์ .csv ใน folder นี้
    call :log "[WARN] No CSV files found in: !CSV_FOLDER!"
)
goto :eof

:: ============================================================
:: SUB: detect_table <filename>
:: ตั้งค่า TABLE_NAME, TMP_COLS, INS_COLS, SEL_COLS, UPD_WHERE
:: ============================================================
:detect_table
set "TABLE_NAME=UNKNOWN"
echo %~1 | findstr /i "^SUB_DISTRICT" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    set "TABLE_NAME=drrs.tbl_mt_sub_district"
    set "TMP_COLS=(lang varchar(2), province_code varchar(2), district_code varchar(2), sub_district_code varchar(4), sub_district_name varchar(50))"
    set "INS_COLS=(lang, province_code, district_code, sub_district_code, sub_district_name, status, created_date, created_by, update_date, update_by, delete_date, delete_by)"
    set "SEL_COLS=lang, province_code, district_code, sub_district_code, sub_district_name, '1', CURRENT_TIMESTAMP, 'Batch_Import', NULL, NULL, NULL, NULL"
    set "UPD_WHERE=t.lang=tmp.lang AND t.province_code=tmp.province_code AND t.district_code=tmp.district_code AND t.sub_district_code=tmp.sub_district_code"
    goto :eof
)
echo %~1 | findstr /i "^DISTRICT" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    set "TABLE_NAME=drrs.tbl_mt_district"
    set "TMP_COLS=(lang varchar(2), province_code varchar(2), district_code varchar(2), district_name varchar(50))"
    set "INS_COLS=(lang, province_code, district_code, district_name, status, created_date, created_by, update_date, update_by, delete_date, delete_by)"
    set "SEL_COLS=lang, province_code, district_code, district_name, '1', CURRENT_TIMESTAMP, 'Batch_Import', NULL, NULL, NULL, NULL"
    set "UPD_WHERE=t.lang=tmp.lang AND t.province_code=tmp.province_code AND t.district_code=tmp.district_code"
    goto :eof
)
echo %~1 | findstr /i "^PROVINCE" >nul 2>&1
if !ERRORLEVEL! EQU 0 (
    set "TABLE_NAME=drrs.tbl_mt_province"
    set "TMP_COLS=(lang varchar(2), province_code varchar(2), province_name varchar(50))"
    set "INS_COLS=(lang, province_code, province_name, status, created_date, created_by, update_date, update_by, delete_date, delete_by)"
    set "SEL_COLS=lang, province_code, province_name, '1', CURRENT_TIMESTAMP, 'Batch_Import', NULL, NULL, NULL, NULL"
    set "UPD_WHERE=t.lang=tmp.lang AND t.province_code=tmp.province_code"
    goto :eof
)
goto :eof

:: ============================================================
:: SUB: import_file <filepath>
:: ============================================================
:import_file
set "F_PATH=%~1"
set "F_NAME=%~nx1"
echo ------------------------------------------
echo Importing: !F_NAME!
call :log "[START] Importing: !F_PATH!"

:: --- Auto-detect table ---
call :detect_table "!F_NAME!"
if "!TABLE_NAME!"=="UNKNOWN" (
    echo [SKIP] ไม่รู้จักชื่อไฟล์ -- ข้าม: !F_NAME!
    echo        ชื่อต้องขึ้นต้นด้วย PROVINCE_, DISTRICT_, หรือ SUB_DISTRICT_
    call :log "[SKIP] Unknown file pattern: !F_NAME!"
    goto :eof
)
echo [INFO] Table : !TABLE_NAME!

set "TEMP_CSV=!TEMP_IMPORT_DIR!\import_tmp.csv"

:: --- Step 1: Convert encoding Win-874 -> UTF-8 ---
echo [INFO] กำลังแปลง encoding Win-874 to UTF-8...
powershell -NoProfile -ExecutionPolicy Bypass -File "!SCRIPT_DIR!convert_encoding.ps1" -src "!F_PATH!" -dst "!TEMP_CSV!" -enc 874
if !ERRORLEVEL! NEQ 0 (
    echo [ERR] แปลง encoding ล้มเหลว: !F_NAME!
    call :log "[ERROR] Encoding conversion failed: !F_PATH!"
    set /a ERROR_COUNT+=1
    goto :eof
)
if not exist "!TEMP_CSV!" (
    echo [ERR] temp file ไม่ถูกสร้าง
    call :log "[ERROR] Temp file missing: !F_PATH!"
    set /a ERROR_COUNT+=1
    goto :eof
)
for %%A in ("!TEMP_CSV!") do set "TEMP_SIZE=%%~zA"
if "!TEMP_SIZE!"=="0" (
    echo [ERR] temp file ว่างเปล่า
    call :log "[ERROR] Temp file empty: !F_PATH!"
    set /a ERROR_COUNT+=1
    goto :eof
)
echo [INFO] แปลง encoding สำเร็จ (!TEMP_SIZE! bytes)

:: --- Step 2: Build SQL ---
set "TEMP_CSV_FWD=!TEMP_CSV:\=/!"
set "TEMP_SQL=%TEMP%\pg_import_%RANDOM%.sql"

(
    echo \set ON_ERROR_STOP on
    echo BEGIN;
    echo.
    echo -- 1. โหลด CSV เข้า temp table
    echo CREATE TEMP TABLE _tmp_import !TMP_COLS!;
    echo \copy _tmp_import FROM '!TEMP_CSV_FWD!' WITH ^(FORMAT csv, DELIMITER '!DELIMITER!', NULL '', ENCODING 'UTF8'^)
    echo.
    echo -- 2. Soft delete record ที่ key ตรงกัน (ถ้ามีอยู่แล้ว)
    echo UPDATE !TABLE_NAME! t
    echo SET    status      = '0',
    echo        delete_date = CURRENT_TIMESTAMP,
    echo        delete_by   = 'Batch_Import'
    echo FROM   _tmp_import tmp
    echo WHERE  !UPD_WHERE!
    echo AND    t.status ^<^> '0';
    echo.
    echo -- 3. INSERT ข้อมูลใหม่
    echo INSERT INTO !TABLE_NAME! !INS_COLS!
    echo SELECT !SEL_COLS! FROM _tmp_import;
    echo.
    echo DROP TABLE _tmp_import;
    echo COMMIT;
) > "!TEMP_SQL!"

:: --- Step 3: Run psql ---
echo [INFO] กำลัง import (soft delete + re-insert)...
set "PG_ERR_FILE=%TEMP%\pg_err_%RANDOM%.txt"
"!PSQL!" -h "!DB_HOST!" -p "!DB_PORT!" -U "!DB_USER!" -d "!DB_NAME!" -f "!TEMP_SQL!" 2>"!PG_ERR_FILE!"
set "EXIT_CODE=!ERRORLEVEL!"

if !EXIT_CODE! EQU 0 (
    echo [OK]  Import สำเร็จ: !F_NAME! -> !TABLE_NAME!
    call :log "[OK] Imported: !F_PATH! -> !TABLE_NAME!"
    set /a SUCCESS_COUNT+=1
) else (
    echo [ERR] Import ล้มเหลว: !F_NAME!
    call :log "[ERROR] Failed: !F_PATH! (exit=!EXIT_CODE!)"
    call :log "--- psql error output ---"
    for /f "delims=" %%L in ('type "!PG_ERR_FILE!" 2^>nul') do (
        call :log "  %%L"
    )
    call :log "--- end error output ---"
    set /a ERROR_COUNT+=1
)

del /q "!TEMP_SQL!" >nul 2>&1
del /q "!TEMP_CSV!" >nul 2>&1
del /q "!PG_ERR_FILE!" >nul 2>&1
goto :eof

:: ============================================================
:log
echo [%time%] %~1 >> "!LOG_FILE!"
goto :eof