package com.bitcomputer.employee_portal.common;

import java.time.Instant;
import java.util.Map;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 배포 연결 확인용. React 첫 화면이 이 값을 호출해 프론트-백엔드 연결을 보여준다.
 * (DB 포함 인프라 상태는 /actuator/health 가 담당)
 */
@RestController
public class HealthController {

    @GetMapping("/api/health")
    public Map<String, Object> health() {
        return Map.of("status", "ok", "time", Instant.now().toString());
    }
}
