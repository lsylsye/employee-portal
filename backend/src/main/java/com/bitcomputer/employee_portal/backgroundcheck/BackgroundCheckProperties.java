package com.bitcomputer.employee_portal.backgroundcheck;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.Period;

/**
 * 신원조회 설정(application.yaml 의 bg.*). 타임아웃·폴링 값의 근거는 MEASUREMENTS.md §7.
 * - retentionAfterBlock: 접근 차단일 + 이 기간이 지난 결과는 조회 때 보여 주지 않는다. 회사 정책 값(기본 1년, 법적 근거 미확인).
 * - baseUrl / apiKey: 외부 API. 키는 환경변수(BGCHECK_API_KEY)로만, 기본값 없음.
 * - postTimeout: POST 시도당(§7-1). pollTimeout: 폴링 GET 시도당(§7-1, 서버 상한 약 30초).
 */
@ConfigurationProperties(prefix = "bg")
public record BackgroundCheckProperties(
        Period retentionAfterBlock,
        String baseUrl,
        String apiKey,
        Duration connectTimeout,
        Duration postTimeout,
        Duration pollTimeout,
        Polling polling) {

    /**
     * firstDelay: POST 후 첫 폴링까지(§7-3). interval: 폴링 간격, 고정(§7-3, Retry-After 는 따르지 않음 §7-5).
     * maxWait: 요청 후 이 시간이 지나도 최종 결과가 없으면 UNRESOLVED(§7-3).
     * orphanPendingAfter: check_id 없이 이보다 오래된 PENDING 은 UNRESOLVED 로 복구한다
     * (행 생성 직후 서버가 죽으면 조건부 유니크 때문에 그 직원을 다시 조회할 수 없게 되므로. 사용자 지정 규칙).
     */
    public record Polling(boolean enabled, Duration firstDelay, Duration interval, Duration maxWait,
                          Duration orphanPendingAfter) {
    }
}
