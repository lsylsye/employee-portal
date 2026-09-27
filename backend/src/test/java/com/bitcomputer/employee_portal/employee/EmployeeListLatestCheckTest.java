package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckStatus;
import com.bitcomputer.employee_portal.config.ClockConfig;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Summary;
import com.bitcomputer.employee_portal.support.MutableClock;
import jakarta.persistence.EntityManagerFactory;
import org.hibernate.SessionFactory;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 관리자 목록의 "직원별 최신 신원조회 상태": DISTINCT ON 단일 쿼리(N+1 없음), 보관 기간 필터링.
 * 오늘 = 2026-10-01(KST), 보관 기간 = 1년 → 차단일이 2025-10-01 이하면 결과를 붙이지 않는다.
 */
@SpringBootTest(properties = "spring.jpa.properties.hibernate.generate_statistics=true")
@Transactional
@Import(EmployeeListLatestCheckTest.ClockOverride.class)
class EmployeeListLatestCheckTest {

    static final Instant NOW = Instant.parse("2026-10-01T01:00:00Z"); // KST 10/1 10:00

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(NOW, ClockConfig.KST);
        }
    }

    @Autowired AdminEmployeeService adminEmployeeService;
    @Autowired JdbcTemplate jdbc;
    @Autowired EntityManagerFactory entityManagerFactory;

    @BeforeEach
    void setUp() {
        jdbc.update("INSERT INTO account (login_id, password_hash, role) VALUES ('test-admin', 'x', 'ADMIN')");
        // EMP-001: 이전 CLEAR, 최신 FLAGGED → FLAGGED
        check("EMP-001", "CLEAR", "2026-09-01T00:00:00Z");
        check("EMP-001", "FLAGGED", "2026-09-20T00:00:00Z");
        // EMP-002: 진행 중
        check("EMP-002", "PENDING", "2026-09-30T00:00:00Z");
        // EMP-008: 차단일이 정확히 1년 전 → 보관 기간 지남 → 가림
        block("EMP-008", "2025-10-01");
        check("EMP-008", "CLEAR", "2025-01-01T00:00:00Z");
        // EMP-009: 차단일이 1년 전 다음 날 → 아직 보관 → 보임
        block("EMP-009", "2025-10-02");
        check("EMP-009", "CLEAR", "2025-01-01T00:00:00Z");
    }

    @Test
    void 직원별_최신_상태를_붙이고_보관_기간이_지난_결과는_가린다() {
        Map<String, Summary> byNo = adminEmployeeService.list().stream()
                .collect(Collectors.toMap(Summary::employeeNo, Function.identity()));

        assertThat(byNo).hasSize(10);
        assertThat(byNo.get("EMP-001").latestCheckStatus()).isEqualTo(BackgroundCheckStatus.FLAGGED);
        assertThat(byNo.get("EMP-001").latestCheckRequestedAt()).isEqualTo(Instant.parse("2026-09-20T00:00:00Z"));
        assertThat(byNo.get("EMP-002").latestCheckStatus()).isEqualTo(BackgroundCheckStatus.PENDING);
        assertThat(byNo.get("EMP-008").latestCheckStatus()).isNull();
        assertThat(byNo.get("EMP-008").status()).isEqualTo(EmploymentStatus.BLOCKED);
        assertThat(byNo.get("EMP-009").latestCheckStatus()).isEqualTo(BackgroundCheckStatus.CLEAR);
        assertThat(byNo.get("EMP-003").latestCheckStatus()).isNull();
    }

    @Test
    void 목록은_직원_수와_관계없이_쿼리_한_번이다() {
        Statistics statistics = entityManagerFactory.unwrap(SessionFactory.class).getStatistics();
        statistics.clear();

        List<Summary> list = adminEmployeeService.list();

        assertThat(list).hasSize(10);
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(1);

        // 계수기가 실제로 쿼리마다 오르는지 확인(항상 1이면 N+1 이 생겨도 못 잡는다)
        adminEmployeeService.list();
        assertThat(statistics.getPrepareStatementCount()).isEqualTo(2);
    }

    private void check(String employeeNo, String status, String requestedAt) {
        boolean completed = !status.equals("PENDING");
        jdbc.update("""
                INSERT INTO background_check (employee_id, check_id, status, requested_by, requested_at, completed_at)
                SELECT e.id, ?, ?, a.id, ?::timestamptz, ?::timestamptz
                  FROM employee e, account a WHERE e.employee_no = ? AND a.login_id = 'test-admin'
                """,
                completed ? "CHK-" + employeeNo + "-" + requestedAt : null, status, requestedAt,
                completed ? requestedAt : null, employeeNo);
    }

    private void block(String employeeNo, String blockedOn) {
        jdbc.update("UPDATE employee SET access_blocked_on = ?::date WHERE employee_no = ?", blockedOn, employeeNo);
    }
}
