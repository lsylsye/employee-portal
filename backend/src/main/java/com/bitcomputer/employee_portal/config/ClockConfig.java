package com.bitcomputer.employee_portal.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;
import java.time.ZoneId;

/**
 * 현재 시각은 이 Clock 으로만 얻는다. 서버(Railway)는 UTC 라서, 시간대 없는 LocalDate.now() 를 쓰면
 * 퇴사 차단일(KST 00:00 기준)이 9시간 어긋난다. 테스트에서는 고정 Clock 으로 바꿔 경계를 검증한다.
 */
@Configuration
public class ClockConfig {

    public static final ZoneId KST = ZoneId.of("Asia/Seoul");

    @Bean
    Clock clock() {
        return Clock.system(KST);
    }
}
