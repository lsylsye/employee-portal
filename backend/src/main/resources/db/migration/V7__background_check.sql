-- 신원조회(BG) 요청과 결과. 직원 : 신원조회 = 1 : N (재조회 허용, 이전 결과는 이력으로 남는다).
--
-- 흐름(판단 2):
--   1) 관리자가 실행하면 외부 POST 전에 PENDING 행을 먼저 만든다(check_id 는 비어 있음).
--      같은 직원에게 PENDING 이 이미 있으면 조건부 유니크에 걸린다 → 409. 버튼을 두 번 눌러도 외부 POST 는 한 번만 나간다.
--   2) 외부 POST 는 트랜잭션 밖에서 보낸다. 성공하면 check_id 를 채운다.
--   3) 백그라운드 폴링이 최종 상태(clear/flagged)를 받으면 결과를 채운다. 최종 상태일 때만 결과를 저장한다.
--
-- 상태:
--   PENDING    진행 중
--   CLEAR      이상 없음
--   FLAGGED    외부 판정 "추가 검토 필요"(사람이 볼 것)
--   UNRESOLVED 결과 미확인(시스템이 결과를 모름). POST 가 애매하게 실패(타임아웃·5xx: 외부에 생성됐을 수 있음),
--              폴링 한도 초과, check_id 없이 오래 남은 PENDING(1단계 직후 서버가 죽은 경우).
--              외부 GET /background-checks?employeeId= 로 실제 생성 여부를 확인할 수 있다.
--   FAILED     POST 가 확실히 거절됨(4xx). 외부에 생성되지 않았다.
--
-- creditScore 는 저장하지 않는다(최소 수집, DECISIONS (3)). 성명·생년월일도 다시 저장하지 않는다(직원 테이블에 있다).

CREATE TABLE background_check (
    id                  BIGSERIAL   PRIMARY KEY,
    employee_id         BIGINT      NOT NULL,
    check_id            VARCHAR(64),             -- 외부 checkId. POST 성공 전에는 비어 있다
    status              VARCHAR(20) NOT NULL,
    criminal_record     BOOLEAN,                 -- 결과는 최종 상태(CLEAR/FLAGGED)일 때만 채운다
    education_verified  BOOLEAN,
    employment_verified BOOLEAN,
    requested_by        BIGINT      NOT NULL,    -- 실행한 관리자 계정
    requested_at        TIMESTAMPTZ NOT NULL,
    completed_at        TIMESTAMPTZ,             -- 외부 API 의 completedAt
    poll_count          INT         NOT NULL DEFAULT 0,
    last_polled_at      TIMESTAMPTZ,
    failure_reason      VARCHAR(40),             -- UNRESOLVED/FAILED 의 사유 코드(응답 본문·개인정보는 담지 않는다)
    CONSTRAINT background_check_check_id_uk UNIQUE (check_id),
    CONSTRAINT background_check_employee_fk FOREIGN KEY (employee_id) REFERENCES employee (id) ON DELETE RESTRICT,
    CONSTRAINT background_check_requested_by_fk FOREIGN KEY (requested_by) REFERENCES account (id) ON DELETE RESTRICT,
    CONSTRAINT background_check_status_ck CHECK (status IN ('PENDING', 'CLEAR', 'FLAGGED', 'UNRESOLVED', 'FAILED')),
    -- 최종 판정은 외부 checkId 와 완료 시각이 있어야 한다
    CONSTRAINT background_check_final_ck CHECK (
        status NOT IN ('CLEAR', 'FLAGGED') OR (check_id IS NOT NULL AND completed_at IS NOT NULL))
);

-- 직원별 이력과 최신 1건(관리자 목록의 DISTINCT ON 조회)
CREATE INDEX background_check_employee_requested_at_idx ON background_check (employee_id, requested_at DESC);

-- 백그라운드 폴링 대상(진행 중인 것만, 오래된 순)
CREATE INDEX background_check_pending_idx ON background_check (requested_at) WHERE status = 'PENDING';

-- 직원당 진행 중인 조회는 하나(중복 실행 방지, DB 에서 최종 방어)
CREATE UNIQUE INDEX background_check_one_pending_uk ON background_check (employee_id) WHERE status = 'PENDING';
