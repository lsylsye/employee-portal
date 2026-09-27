package com.bitcomputer.employee_portal.employee;

/** 접근 차단일과 오늘(KST)로 계산하는 상태. 저장하지 않는다. */
public enum EmploymentStatus {
    ACTIVE,
    /** 차단일이 미래(예약 퇴사) */
    BLOCK_SCHEDULED,
    /** 차단일이 오늘 이하 */
    BLOCKED
}
