package com.bitcomputer.employee_portal.employee;

import java.time.Instant;
import java.time.LocalDate;

/** 관리자 목록 한 줄: 직원 + 최신 신원조회 상태(없거나 보관 기간이 지났으면 null). 네이티브 쿼리 결과 투영. */
public interface EmployeeListRow {
    String getEmployeeNo();
    String getFullName();
    LocalDate getBirthDate();
    LocalDate getAccessBlockedOn();
    String getLatestCheckStatus();
    Instant getLatestCheckRequestedAt();
}
