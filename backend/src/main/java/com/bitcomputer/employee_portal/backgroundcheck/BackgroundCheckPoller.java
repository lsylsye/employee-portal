package com.bitcomputer.employee_portal.backgroundcheck;

import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 백그라운드 폴링. interval(10초) 고정 간격, 앞 바퀴가 끝난 뒤에 다음 바퀴를 돈다(fixedDelay → 겹치지 않는다).
 * 테스트에서는 끄고(bg.polling.enabled=false) pollOnce() 를 직접 부른다.
 */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(prefix = "bg.polling", name = "enabled", havingValue = "true", matchIfMissing = true)
public class BackgroundCheckPoller {

    private final BackgroundCheckService backgroundCheckService;

    @Scheduled(fixedDelayString = "${bg.polling.interval}", initialDelayString = "${bg.polling.interval}")
    void poll() {
        backgroundCheckService.pollOnce();
    }
}
