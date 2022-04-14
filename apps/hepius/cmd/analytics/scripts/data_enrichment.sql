DROP TABLE IF EXISTS laguna.member_enhanced;
CREATE TABLE laguna.member_enhanced AS (
    SELECT *,
           FALSE                   AS engaged,
           CAST(NULL AS CHAR(20))  AS dc_date_change,
           CAST(NULL AS DATE)      AS deceased_date,
           CAST(NULL AS CHAR(100)) AS deceased_cause,
           CURRENT_TIMESTAMP       AS data_refresh_datetime
    FROM laguna.harmony_member
)
;
