package com.bitcomputer.employee_portal.backgroundcheck;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.time.Duration;
import java.time.Period;

/**
 * 신원조회 설정(application.yaml 의 bg.*).
 * - retentionAfterBlock: 접근 차단일 + 이 기간이 지난 결과는 조회 때 보여 주지 않는다. 회사 정책 값(기본 1년, 법적 근거 미확인).
 * - baseUrl / apiKey: 외부 API. 키는 환경변수(BGCHECK_API_KEY)로만, 기본값 없음.
 * - connectTimeout / readTimeout / polling.*: 실측(MEASUREMENTS) 확정 전 임시값. 근거가 정해지면 교체한다.
 */
@ConfigurationProperties(prefix = "bg")
public record BackgroundCheckProperties(
        Period retentionAfterBlock,
        String baseUrl,
        String apiKey,
        Duration connectTimeout,
        Duration readTimeout,
        Polling polling) {

    /**
     * interval: 폴링 주기. maxAttempts: 이 횟수를 넘기면 UNRESOLVED(폴링 한도 초과).
     * orphanPendingAfter: check_id 없이 이 시간보다 오래된 PENDING 은 UNRESOLVED 로 복구한다
     * (행 생성 직후 서버가 죽으면 조건부 유니크 때문에 그 직원을 다시 조회할 수 없게 되므로).
     */
    public record Polling(boolean enabled, Duration interval, int maxAttempts, Duration orphanPendingAfter) {
    }
}
