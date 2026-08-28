-- =============================================================================
-- Load Test Data Seed Script
-- =============================================================================
-- Database : PostgreSQL (schema: drrs)
-- Target   : tbl_cus_target          → 10,000 rows
--            tbl_account_cus_target   → 40,000 rows (4 per customer)
-- Pattern  : citizen_id  = LPAD(i::text, 13, '0')   e.g. '0000000000001'
--            last_name   = 'loadtest-' || LPAD(i::text, 5, '0')
--            cif_no      = '5' || LPAD(i::text, 3, '0')
--            account_no  = 2 accounts per customer
-- Usage    : psql -h <host> -U <user> -d postgres -f seed-loadtest-data.sql
-- =============================================================================

-- ─── 0) CLEANUP (uncomment to re-run) ───────────────────────────────────────
-- DELETE FROM loadtest.tbl_account_cus_target WHERE created_by = 'loadtest-drrs-app';
-- DELETE FROM loadtest.tbl_cus_target          WHERE created_by = 'loadtest-drrs-app';

BEGIN;

-- ─── 1) INSERT tbl_cus_target (10,000 rows) ─────────────────────────────────
--    CTE returns the new id together with the sequence number (i)
--    so we can join it later for the account rows.
WITH new_customers AS (
    INSERT INTO loadtest.tbl_cus_target
        (citizen_id, first_name, last_name, verify_code, status,
         created_date, created_by, cif_no)
    SELECT
        LPAD(i::text, 13, '0'),                         -- citizen_id  (13 digits)
        'ทดสอบ',                                         -- first_name
        'loadtest-' || LPAD(i::text, 5, '0'),            -- last_name   e.g. loadtest-00001
        '0000',                                          -- verify_code
        '1',                                             -- status
        CURRENT_TIMESTAMP,                               -- created_date
        'loadtest-drrs-app',                             -- created_by
        '5' || LPAD((i % 1000)::text, 3, '0')           -- cif_no      e.g. 5000 … 5999 (cycling)
    FROM generate_series(1, 10000) AS gs(i)
    RETURNING id,
              -- extract sequence number back from citizen_id
              LTRIM(citizen_id, '0')::int AS seq
),

-- ─── 2) INSERT tbl_account_cus_target ────────────────────────────────────────
--    Each customer gets 4 rows:
--      account_no #1  ×  plan_no 01  (lump-sum)
--      account_no #1  ×  plan_no 02  (instalment)
--      account_no #2  ×  plan_no 01  (lump-sum)
--      account_no #2  ×  plan_no 02  (instalment)

account_rows AS (
    SELECT
        c.id                                             AS cus_target_id,
        LPAD(acct.n::text, 20, '0')                      AS account_no,
        plan.plan_no,
        '1'                                              AS status,
        plan.min_amount,
        plan.max_amount,
        plan.payment_amount,
        plan.installment_terms,
        CURRENT_TIMESTAMP                                AS created_date,
        'loadtest-drrs-app'                              AS created_by
    FROM new_customers c
    -- two account numbers per customer: seq*2-1 and seq*2
    CROSS JOIN LATERAL (
        VALUES (c.seq * 2 - 1), (c.seq * 2)
    ) AS acct(n)
    -- two plans per account
    CROSS JOIN LATERAL (
        VALUES
            -- plan 01 : lump-sum payment
            ('01'::text, NULL::numeric, NULL::numeric,
             CASE WHEN acct.n % 2 = 1 THEN 12000 ELSE 38000 END::numeric,
             NULL::int),
            -- plan 02 : instalment payment
            ('02'::text,
             CASE WHEN acct.n % 2 = 1 THEN 3000 ELSE 1000 END::numeric,
             CASE WHEN acct.n % 2 = 1 THEN 8000 ELSE 3000 END::numeric,
             CASE WHEN acct.n % 2 = 1 THEN 3000 ELSE 1000 END::numeric,
             CASE WHEN acct.n % 2 = 1 THEN 24   ELSE 12   END::int)
    ) AS plan(plan_no, min_amount, max_amount, payment_amount, installment_terms)
)

INSERT INTO loadtest.tbl_account_cus_target
    (cus_target_id, account_no, plan_no, status,
     min_amount, max_amount, payment_amount, installment_terms,
     created_date, created_by)
SELECT
    cus_target_id, account_no, plan_no, status,
    min_amount, max_amount, payment_amount, installment_terms,
    created_date, created_by
FROM account_rows;

COMMIT;

-- ─── 3) VERIFY ──────────────────────────────────────────────────────────────
SELECT 'tbl_cus_target'          AS tbl, COUNT(*) AS cnt
  FROM loadtest.tbl_cus_target
 WHERE created_by = 'loadtest-drrs-app'
UNION ALL
SELECT 'tbl_account_cus_target', COUNT(*)
  FROM loadtest.tbl_account_cus_target
 WHERE created_by = 'loadtest-drrs-app';
