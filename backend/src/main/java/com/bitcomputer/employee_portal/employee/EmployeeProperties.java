package com.bitcomputer.employee_portal.employee;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Period;

/**
 * 직원 설정(application.yaml 의 employee.*).
 * recoveryWindow: 퇴사일부터 이 기간 안에는 계정 복구(퇴사 번복)를 할 수 있다. 지나면 영구 퇴사다. 회사 정책 값(기본 7일).
 */
@ConfigurationProperties(prefix = "employee")
public record EmployeeProperties(Period recoveryWindow) {
}
