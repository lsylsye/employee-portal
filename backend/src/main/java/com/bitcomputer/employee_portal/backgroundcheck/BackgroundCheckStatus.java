package com.bitcomputer.employee_portal.backgroundcheck;

/**
 * FLAGGED 와 UNRESOLVED 는 의미가 완전히 다르다.
 * FLAGGED 는 외부 판정("사람이 검토해야 함"), UNRESOLVED 는 "시스템이 결과를 모름"(화면: 결과 미확인, 빨간 배지).
 */
public enum BackgroundCheckStatus {
    PENDING,
    CLEAR,
    FLAGGED,
    /** 결과 미확인. 외부 GET ?employeeId= 로 실제 생성 여부를 확인할 수 있다. */
    UNRESOLVED,
    /** POST 가 4xx 로 확실히 거절됨. 외부에 생성되지 않았다. */
    FAILED;

    public boolean isFinal() {
        return this == CLEAR || this == FLAGGED;
    }
}
