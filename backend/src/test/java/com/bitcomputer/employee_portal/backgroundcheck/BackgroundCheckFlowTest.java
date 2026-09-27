package com.bitcomputer.employee_portal.backgroundcheck;

import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.CreateOutcome;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.FetchOutcome;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.Result;
import com.bitcomputer.employee_portal.config.ClockConfig;
import com.bitcomputer.employee_portal.support.ApiSession;
import com.bitcomputer.employee_portal.support.MutableClock;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 신원조회 흐름(DECISIONS (2)): 실행 → POST → 폴링 → 결과 저장, 복구 규칙, 조회 API.
 * 외부 API 는 가짜 클라이언트로 바꾼다(실제 호출 없음). 서비스가 단계마다 트랜잭션을 열기 때문에
 * 테스트 트랜잭션으로 묶지 않고, 전용 테스트 직원을 만들고 끝나면 지운다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Import(BackgroundCheckFlowTest.Overrides.class)
class BackgroundCheckFlowTest {

    static final Instant T0 = Instant.parse("2026-10-01T01:00:00Z"); // KST 10/1 10:00
    static final String ADMIN = "bg-test-admin";
    static final String PASSWORD = "test-password";
    static final String OK = "BG-OK";          // 정상 직원(계정 있음)
    static final String NO_DOB = "BG-NODOB";   // 생년월일 없음
    static final String BLOCKED = "BG-BLOCKED"; // 퇴사 처리됨
    static final List<String> EMPLOYEES = List.of(OK, NO_DOB, BLOCKED);

    @TestConfiguration
    static class Overrides {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(T0, ClockConfig.KST);
        }

        @Bean
        @Primary
        FakeBackgroundCheckClient fakeBackgroundCheckClient() {
            return new FakeBackgroundCheckClient();
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MutableClock clock;
    @Autowired FakeBackgroundCheckClient client;
    @Autowired BackgroundCheckService service;

    ApiSession admin;

    @BeforeEach
    void setUp() throws Exception {
        cleanUp();
        clock.set(T0);
        client.reset();
        insertEmployee(OK, "남궁", "서준", "1988-07-21", null);
        insertEmployee(NO_DOB, "이", "서연", null, null);
        insertEmployee(BLOCKED, "김", "솔", "1992-12-30", "2026-09-30");
        String hash = passwordEncoder.encode(PASSWORD);
        jdbc.update("INSERT INTO account (login_id, password_hash, role) VALUES (?, ?, 'ADMIN')", ADMIN, hash);
        jdbc.update("INSERT INTO account (login_id, password_hash, role, employee_id) "
                + "SELECT ?, ?, 'EMPLOYEE', id FROM employee WHERE employee_no = ?", OK, hash, OK);
        admin = ApiSession.login(mockMvc, ADMIN, PASSWORD);
    }

    @AfterEach
    void cleanUp() {
        jdbc.update("DELETE FROM spring_session WHERE principal_name IN (?, ?)", ADMIN, OK);
        for (String no : EMPLOYEES) {
            jdbc.update("DELETE FROM background_check WHERE employee_id = (SELECT id FROM employee WHERE employee_no = ?)", no);
            jdbc.update("DELETE FROM employee_change_log WHERE employee_id = (SELECT id FROM employee WHERE employee_no = ?)", no);
        }
        jdbc.update("DELETE FROM account WHERE login_id IN (?, ?)", ADMIN, OK);
        for (String no : EMPLOYEES) {
            jdbc.update("DELETE FROM employee WHERE employee_no = ?", no);
        }
    }

    // ---- 실행 ----

    @Test
    void 실행하면_POST_한_번에_checkId를_채우고_202_성은_lastName으로_보낸다() throws Exception {
        requestCheck(OK).andExpect(status().isAccepted()).andExpect(jsonPath("$.status").value("PENDING"));

        assertThat(client.posts).hasSize(1);
        assertThat(client.posts.get(0).lastName()).isEqualTo("남궁");
        assertThat(client.posts.get(0).firstName()).isEqualTo("서준");
        assertThat(row(OK).get("check_id")).isNotNull();
    }

    @Test
    void 진행_중에_다시_실행하면_409이고_외부_POST는_더_나가지_않는다() throws Exception {
        requestCheck(OK).andExpect(status().isAccepted());

        requestCheck(OK).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("BACKGROUND_CHECK_IN_PROGRESS"));
        assertThat(client.posts).hasSize(1);
    }

    @Test
    void 생년월일이_없거나_퇴사자면_422이고_외부를_부르지_않는다() throws Exception {
        requestCheck(NO_DOB).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("BIRTH_DATE_REQUIRED"));
        requestCheck(BLOCKED).andExpect(status().isUnprocessableContent())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_ACCESS_BLOCKED"));
        assertThat(client.posts).isEmpty();
    }

    @Test
    void POST가_4xx면_FAILED_애매하면_UNRESOLVED이고_다시_실행할_수_있다() throws Exception {
        client.createOutcomes.add(new CreateOutcome.Rejected(400));
        requestCheck(OK).andExpect(jsonPath("$.status").value("FAILED"));

        client.createOutcomes.add(new CreateOutcome.Unknown("POST_IO_ERROR"));
        requestCheck(OK).andExpect(jsonPath("$.status").value("UNRESOLVED"))
                .andExpect(jsonPath("$.failureReason").value("POST_IO_ERROR"));

        requestCheck(OK).andExpect(status().isAccepted()); // PENDING 이 남지 않아 재실행 가능
        assertThat(client.posts).hasSize(3);
    }

    // ---- 폴링 ----

    @Test
    void 첫_폴링은_25초_뒤_최종_결과를_받으면_저장하고_creditScore는_없다() throws Exception {
        requestCheck(OK);

        clock.set(T0.plusSeconds(24));
        service.pollOnce();
        assertThat(client.gets).isEmpty(); // 첫 폴링 전

        client.fetchOutcomes.add(new FetchOutcome.Fetched(new Result("pending", null, null, null, null)));
        clock.set(T0.plusSeconds(25));
        service.pollOnce();
        assertThat(row(OK).get("status")).isEqualTo("PENDING");

        clock.set(T0.plusSeconds(30));
        service.pollOnce();
        assertThat(client.gets).hasSize(1); // 간격(10초) 전이라 부르지 않는다

        client.fetchOutcomes.add(new FetchOutcome.Fetched(new Result("flagged", true, true, false,
                Instant.parse("2026-10-01T01:00:40Z"))));
        clock.set(T0.plusSeconds(35));
        service.pollOnce();

        Map<String, Object> row = row(OK);
        assertThat(row.get("status")).isEqualTo("FLAGGED");
        assertThat(row.get("criminal_record")).isEqualTo(true);
        assertThat(row.get("employment_verified")).isEqualTo(false);
        assertThat(row).doesNotContainKey("credit_score");
    }

    @Test
    void 일시적_실패는_다음_바퀴에_다시_보고_5분이_지나면_UNRESOLVED() throws Exception {
        requestCheck(OK);
        for (int s = 25; s < 300; s += 10) {
            clock.set(T0.plusSeconds(s));
            service.pollOnce(); // 가짜 클라이언트 기본값: GET 500(일시적 실패)
        }
        assertThat(row(OK).get("status")).isEqualTo("PENDING");

        clock.set(T0.plus(Duration.ofMinutes(5)));
        service.pollOnce();

        assertThat(row(OK).get("status")).isEqualTo("UNRESOLVED");
        assertThat(row(OK).get("failure_reason")).isEqualTo("POLL_TIMEOUT");
    }

    @Test
    void GET_404면_즉시_UNRESOLVED() throws Exception {
        requestCheck(OK);
        client.fetchOutcomes.add(new FetchOutcome.NotAvailable(404));
        clock.set(T0.plusSeconds(25));

        service.pollOnce();

        assertThat(row(OK).get("status")).isEqualTo("UNRESOLVED");
        assertThat(row(OK).get("failure_reason")).isEqualTo("GET_404");
    }

    @Test
    void checkId_없이_1분_넘게_남은_PENDING은_복구되어_다시_실행할_수_있다() throws Exception {
        // 행 생성 직후 서버가 죽은 상황: check_id 없는 PENDING
        jdbc.update("INSERT INTO background_check (employee_id, status, requested_by, requested_at) "
                + "SELECT e.id, 'PENDING', a.id, ?::timestamptz FROM employee e, account a "
                + "WHERE e.employee_no = ? AND a.login_id = ?", "2026-10-01T01:00:00Z", OK, ADMIN);
        requestCheck(OK).andExpect(status().isConflict()); // 유니크 제약 때문에 막혀 있다

        clock.set(T0.plusSeconds(59));
        service.pollOnce();
        assertThat(row(OK).get("status")).isEqualTo("PENDING"); // 1분 전에는 건드리지 않는다

        clock.set(T0.plusSeconds(60));
        service.pollOnce();
        assertThat(row(OK).get("status")).isEqualTo("UNRESOLVED");
        assertThat(row(OK).get("failure_reason")).isEqualTo("ORPHANED_PENDING");

        requestCheck(OK).andExpect(status().isAccepted());
    }

    // ---- 조회 ----

    @Test
    void 관리자는_상세_결과를_no_store로_보고_직원은_진행_상태만_본다() throws Exception {
        requestCheck(OK);
        client.fetchOutcomes.add(new FetchOutcome.Fetched(new Result("clear", false, true, true, T0.plusSeconds(30))));
        clock.set(T0.plusSeconds(25));
        service.pollOnce();
        Long id = ((Number) row(OK).get("id")).longValue();

        admin.send(get("/api/admin/employees/" + OK + "/background-checks"))
                .andExpect(jsonPath("$[0].status").value("CLEAR"))
                .andExpect(jsonPath("$[0].criminalRecord").doesNotExist());
        admin.send(get("/api/admin/background-checks/" + id))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.criminalRecord").value(false))
                .andExpect(jsonPath("$.creditScore").doesNotExist());

        ApiSession employee = ApiSession.login(mockMvc, OK, PASSWORD);
        employee.send(get("/api/me/background-checks"))
                .andExpect(jsonPath("$[0].progress").value("COMPLETED"))
                .andExpect(jsonPath("$[0].status").doesNotExist())
                .andExpect(jsonPath("$[0].criminalRecord").doesNotExist());
        employee.send(get("/api/admin/background-checks/" + id)).andExpect(status().isForbidden());
    }

    @Test
    void 보관_기간이_지난_결과는_이력과_상세에서_보이지_않는다() throws Exception {
        requestCheck(OK);
        Long id = ((Number) row(OK).get("id")).longValue();
        jdbc.update("UPDATE employee SET access_blocked_on = ?::date WHERE employee_no = ?", "2025-10-01", OK);

        admin.send(get("/api/admin/employees/" + OK + "/background-checks")).andExpect(jsonPath("$.length()").value(0));
        admin.send(get("/api/admin/background-checks/" + id)).andExpect(status().isNotFound());
    }

    // ---- helpers ----

    private org.springframework.test.web.servlet.ResultActions requestCheck(String employeeNo) throws Exception {
        return admin.send(post("/api/admin/employees/" + employeeNo + "/background-checks"));
    }

    private Map<String, Object> row(String employeeNo) {
        return jdbc.queryForMap("SELECT * FROM background_check WHERE employee_id = "
                + "(SELECT id FROM employee WHERE employee_no = ?) ORDER BY id DESC LIMIT 1", employeeNo);
    }

    private void insertEmployee(String no, String last, String first, String birthDate, String blockedOn) {
        jdbc.update("INSERT INTO employee (employee_no, full_name, last_name, first_name, birth_date, access_blocked_on) "
                + "VALUES (?, ?, ?, ?, ?::date, ?::date)", no, last + first, last, first, birthDate, blockedOn);
    }
}
