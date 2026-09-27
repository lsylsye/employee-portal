-- 판단 (4): 직원 정보 수정은 즉시 반영하고, 변경 사실만 남긴다(값은 남기지 않는다).
-- 누가(changed_by), 언제(changed_at), 누구의(employee_id), 어떤 필드(field_name). 이전 값·새 값은 저장하지 않는다
-- (과거 연락처·주소가 쌓이지 않게. 최소 수집 N5). 조회 API·화면은 두지 않고 DB 에만 남긴다.
-- 직원 본인 수정, 관리자 수정(성명·생년월일 = BG 입력값 포함), 퇴사 처리·취소를 같은 곳에 기록한다.

CREATE TABLE employee_change_log (
    id           BIGSERIAL   PRIMARY KEY,
    employee_id  BIGINT      NOT NULL,
    changed_by   BIGINT      NOT NULL,   -- 수정한 계정(본인 또는 관리자)
    field_name   VARCHAR(40) NOT NULL,
    changed_at   TIMESTAMPTZ NOT NULL,   -- 앱의 Clock 으로 넣는다(테스트에서 시각 고정)
    -- 직원은 삭제하지 않는다(퇴사도 레코드 보존). 실수로 지우려 하면 막는다.
    CONSTRAINT employee_change_log_employee_fk FOREIGN KEY (employee_id) REFERENCES employee (id) ON DELETE RESTRICT,
    CONSTRAINT employee_change_log_changed_by_fk FOREIGN KEY (changed_by) REFERENCES account (id) ON DELETE RESTRICT,
    CONSTRAINT employee_change_log_field_ck CHECK (field_name IN (
        'lastName', 'firstName', 'birthDate',
        'phone', 'email', 'address', 'emergencyContact',
        'accessBlockedOn'))
);

-- 직원별 최근 변경 조회
CREATE INDEX employee_change_log_employee_changed_at_idx ON employee_change_log (employee_id, changed_at DESC);

-- 계정 → 직원 FK 의 삭제 정책을 명시한다. V2 는 지정하지 않아 기본값 NO ACTION 이었다.
-- (지연 불가 제약에서는 RESTRICT 와 결과가 같지만, "직원은 삭제하지 않는다"는 의도를 드러낸다)
ALTER TABLE account DROP CONSTRAINT account_employee_fk;
ALTER TABLE account ADD CONSTRAINT account_employee_fk
    FOREIGN KEY (employee_id) REFERENCES employee (id) ON DELETE RESTRICT;
