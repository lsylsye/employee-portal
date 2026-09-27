package com.bitcomputer.employee_portal.employee;

import java.time.LocalDate;

/** 접근 차단일과 오늘(KST)로 계산하는 상태. 저장하지 않는다. */
public enum EmploymentStatus {
    ACTIVE,
    /** 차단일이 미래(예약 퇴사) */
    BLOCK_SCHEDULED,
    /** 차단일이 오늘 이하 */
    BLOCKED;

    /** today 는 KST 날짜. 차단일 당일부터 차단이다. */
    public static EmploymentStatus of(LocalDate accessBlockedOn, LocalDate today) {
        if (accessBlockedOn == null) {
            return ACTIVE;
        }
        return today.isBefore(accessBlockedOn) ? BLOCK_SCHEDULED : BLOCKED;
    }
}
