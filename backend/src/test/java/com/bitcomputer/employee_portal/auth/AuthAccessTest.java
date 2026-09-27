package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.config.ClockConfig;
import com.bitcomputer.employee_portal.support.MutableClock;
import jakarta.servlet.http.Cookie;
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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * T1 접근 통제(인증·역할 부분) + T2 퇴사자 차단(KST 경계, 기존 세션 차단).
 * 직원 본인 API·관리자 API 케이스는 해당 브랜치에서 추가한다.
 * CSRF 는 실제 흐름(GET /api/auth/csrf → X-XSRF-TOKEN 헤더)으로 보낸다. spring-security-test 의 csrf() 는
 * CSRF 저장소를 세션 기반으로 바꿔 끼워서, 운영에는 없는 익명 세션을 만든다.
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(AuthAccessTest.ClockOverride.class)
class AuthAccessTest {

    /** 차단일. KST 로 이 날 00:00 = UTC 전날 15:00 부터 막혀야 한다. */
    static final LocalDate BLOCKED_ON = LocalDate.of(2026, 10, 1);
    static final Instant KST_BEFORE_MIDNIGHT = Instant.parse("2026-09-30T14:59:59Z"); // KST 9/30 23:59:59
    static final Instant KST_MIDNIGHT = Instant.parse("2026-09-30T15:00:00Z");        // KST 10/1 00:00:00

    static final String EMPLOYEE_ID = "TEST-EMP";
    static final String ADMIN_ID = "test-admin";
    static final String PASSWORD = "test-password";

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(KST_BEFORE_MIDNIGHT, ClockConfig.KST);
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MutableClock clock;
    @Autowired PlatformTransactionManager transactionManager;

    @BeforeEach
    void setUp() {
        clock.set(KST_BEFORE_MIDNIGHT);
        jdbc.update("INSERT INTO employee (employee_no, full_name, last_name, first_name, access_blocked_on) "
                + "VALUES (?, '테스트', '테', '스트', ?)", EMPLOYEE_ID, BLOCKED_ON);
        Long employeeId = jdbc.queryForObject("SELECT id FROM employee WHERE employee_no = ?", Long.class, EMPLOYEE_ID);
        String hash = passwordEncoder.encode(PASSWORD);
        jdbc.update("INSERT INTO account (login_id, password_hash, role, employee_id) VALUES (?, ?, 'EMPLOYEE', ?)",
                EMPLOYEE_ID, hash, employeeId);
        jdbc.update("INSERT INTO account (login_id, password_hash, role) VALUES (?, ?, 'ADMIN')", ADMIN_ID, hash);
    }

    /**
     * Spring Session 은 세션 행을 테스트 트랜잭션과 따로 커밋한다(롤백되지 않는다).
     * 그래서 테스트 계정의 세션은 별도 트랜잭션으로 지운다.
     */
    @AfterEach
    void cleanUpSessions() {
        TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
        requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        requiresNew.executeWithoutResult(status -> jdbc.update(
                "DELETE FROM spring_session WHERE principal_name IN (?, ?)", EMPLOYEE_ID, ADMIN_ID));
    }

    // ---- T1: 인증·역할 ----

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void 직원이_관리자_API를_부르면_403() throws Exception {
        Cookie session = login(EMPLOYEE_ID, PASSWORD);

        mockMvc.perform(get("/api/admin/employees").cookie(session))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    @Test
    void 관리자는_관리자_API_권한_검사를_통과한다() throws Exception {
        Cookie session = login(ADMIN_ID, PASSWORD);

        mockMvc.perform(get("/api/admin/employees").cookie(session))
                .andExpect(status().isOk());
    }

    @Test
    void CSRF_토큰_없이_로그인하면_403() throws Exception {
        mockMvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content(body(EMPLOYEE_ID, PASSWORD)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("CSRF_INVALID"));
    }

    // ---- 로그인 실패 메시지 통일 ----

    @Test
    void 로그인_실패는_이유와_관계없이_같은_응답이다() throws Exception {
        String wrongPassword = loginRaw(EMPLOYEE_ID, "wrong").andReturn().getResponse().getContentAsString();
        String unknownId = loginRaw("NO-SUCH-ID", PASSWORD).andReturn().getResponse().getContentAsString();
        clock.set(KST_MIDNIGHT);
        String blocked = loginRaw(EMPLOYEE_ID, PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_CREDENTIALS"))
                .andReturn().getResponse().getContentAsString();

        assertThat(wrongPassword).isEqualTo(blocked);
        assertThat(unknownId).isEqualTo(blocked);
    }

    // ---- T2: 퇴사자 차단 (KST 경계) ----

    @Test
    void 차단일_직전_KST_23시59분59초에는_로그인할_수_있다() throws Exception {
        loginRaw(EMPLOYEE_ID, PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.loginId").value(EMPLOYEE_ID))
                .andExpect(jsonPath("$.role").value("EMPLOYEE"));
    }

    @Test
    void 이미_로그인한_세션도_KST_자정을_넘기면_다음_요청에서_차단되고_세션이_지워진다() throws Exception {
        Cookie session = login(EMPLOYEE_ID, PASSWORD);
        mockMvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isOk());

        clock.set(KST_MIDNIGHT); // UTC 로는 아직 9/30 15:00 이다

        mockMvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_BLOCKED"));
        assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM spring_session WHERE session_id = ?", Integer.class, sessionId(session))).isZero();
        // 세션이 지워졌으므로 이후에는 미로그인과 같다
        mockMvc.perform(get("/api/auth/me").cookie(session))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    void 로그아웃하면_세션이_끊긴다() throws Exception {
        Cookie session = login(EMPLOYEE_ID, PASSWORD);

        // 로그인하면 CSRF 토큰이 교체되므로 새로 받는다.
        Cookie xsrf = xsrf(session);
        mockMvc.perform(post("/api/auth/logout").cookie(session, xsrf).header("X-XSRF-TOKEN", xsrf.getValue()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/auth/me").cookie(session)).andExpect(status().isUnauthorized());
    }

    // ---- helpers ----

    private Cookie login(String loginId, String password) throws Exception {
        Cookie session = loginRaw(loginId, password).andExpect(status().isOk())
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();
        return session;
    }

    private ResultActions loginRaw(String loginId, String password) throws Exception {
        Cookie xsrf = xsrf(null);
        return mockMvc.perform(post("/api/auth/login").cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue())
                .contentType(MediaType.APPLICATION_JSON).content(body(loginId, password)));
    }

    /** 프론트와 같은 방식으로 CSRF 쿠키를 받는다. */
    private Cookie xsrf(Cookie session) throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) {
            request.cookie(session);
        }
        Cookie xsrf = mockMvc.perform(request).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        return xsrf;
    }

    /** Spring Session 쿠키 값은 세션 ID 의 Base64 인코딩이다. */
    private static String sessionId(Cookie session) {
        return new String(Base64.getDecoder().decode(session.getValue()), StandardCharsets.UTF_8);
    }

    private static String body(String loginId, String password) {
        return "{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}";
    }
}
