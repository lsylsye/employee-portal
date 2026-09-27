-- 접근 차단일(퇴사일)을 계정에서 직원으로 옮긴다.
-- 퇴사는 인사상의 사실이다. 계정에 두면 계정이 없는 직원(시드 9명)은 퇴사 처리를 할 수 없고,
-- "차단일 + 보관 기간" 기준의 BG 파기에서도 빠진다.
-- 계정의 접근 여부는 연결된 직원의 차단일로 판단한다. 직원과 연결되지 않은 계정은 ADMIN 만 통과한다(fail-closed).
-- 관리자 계정은 직원 레코드가 없어서 차단할 수 없다(한계, README "넣지 않은 것").

ALTER TABLE employee ADD COLUMN access_blocked_on DATE;

-- 기존 값 이전. 직원 계정만 대상이다(ADMIN 은 V2 제약상 employee_id 가 없다).
UPDATE employee e
   SET access_blocked_on = a.access_blocked_on
  FROM account a
 WHERE a.employee_id = e.id
   AND a.access_blocked_on IS NOT NULL;

ALTER TABLE account DROP COLUMN access_blocked_on;

COMMENT ON COLUMN employee.access_blocked_on IS
    '접근 차단일. 이 날 00:00 KST 부터 차단. NULL 이면 재직 중. 요청마다 비교하므로 미래 날짜(예약)도 스케줄러 없이 동작. 오입력은 NULL 로 되돌린다.';
