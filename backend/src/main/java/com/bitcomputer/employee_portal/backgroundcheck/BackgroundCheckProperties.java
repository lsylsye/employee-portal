package com.bitcomputer.employee_portal.backgroundcheck;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Period;

/**
 * 신원조회 설정(application.yaml 의 bg.*).
 * retentionAfterBlock: 접근 차단일 + 이 기간이 지난 결과는 조회 때 보여 주지 않는다. 회사 정책 값(기본 1년, 법적 근거 미확인).
 */
@ConfigurationProperties(prefix = "bg")
public record BackgroundCheckProperties(Period retentionAfterBlock) {
}
