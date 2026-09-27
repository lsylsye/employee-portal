-- 직원(인사 레코드)과 계정(로그인 수단)을 나눈다.
-- 관리자는 직원 레코드가 없는 별도 계정이다(F-c). 시드 목록을 수정하지 않기 위함.

CREATE TABLE employee (
    id                BIGSERIAL    PRIMARY KEY,
    employee_no       VARCHAR(20)  NOT NULL,
    -- 원래 성명 문자열은 보존하고, 성·이름을 별도 컬럼으로 둔다.
    -- 복성(남궁, 황보, 선우)은 문자열 규칙으로 나눌 수 없어서 명시적으로 저장한다.
    full_name         VARCHAR(50)  NOT NULL,
    last_name         VARCHAR(20)  NOT NULL,   -- 성 (BG API 의 lastName)
    first_name        VARCHAR(30)  NOT NULL,   -- 이름 (BG API 의 firstName)
    -- 확인되지 않은 생년월일(EMP-007)은 임의 날짜로 채우지 않고 NULL 로 둔다.
    birth_date        DATE,
    -- 직원 본인이 수정하는 인적사항(F-a). 성명·생년월일은 BG 입력값이라 관리자만 수정한다(F-b).
    phone             VARCHAR(20),
    email             VARCHAR(100),
    address           VARCHAR(200),
    emergency_contact VARCHAR(100),
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT employee_no_uk UNIQUE (employee_no),
    -- 성·이름을 고칠 때 성명과 어긋나지 않게 한다.
    CONSTRAINT employee_name_split_ck CHECK (full_name = last_name || first_name)
);

CREATE TABLE account (
    id                BIGSERIAL    PRIMARY KEY,
    -- 직원은 사번을 아이디로 쓴다(F-d). 재입사자는 새 사번이라 중복되지 않는다.
    login_id          VARCHAR(50)  NOT NULL,
    password_hash     VARCHAR(100) NOT NULL,   -- BCrypt (N1)
    role              VARCHAR(20)  NOT NULL,
    employee_id       BIGINT,
    -- 접근 차단일. 이 날 00:00 KST 부터 차단한다. NULL 이면 재직 중이다.
    -- 요청마다 비교하므로 미래 날짜(예약)도 스케줄러 없이 동작한다. 오입력은 NULL 로 되돌린다.
    access_blocked_on DATE,
    created_at        TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT account_login_id_uk UNIQUE (login_id),
    CONSTRAINT account_employee_uk UNIQUE (employee_id),
    CONSTRAINT account_employee_fk FOREIGN KEY (employee_id) REFERENCES employee (id),
    CONSTRAINT account_role_ck CHECK (
        (role = 'ADMIN' AND employee_id IS NULL) OR
        (role = 'EMPLOYEE' AND employee_id IS NOT NULL)
    )
);
