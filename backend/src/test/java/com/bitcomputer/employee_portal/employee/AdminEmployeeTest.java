package com.bitcomputer.employee_portal.employee;

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
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import com.jayway.jsonpath.JsonPath;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 관리자 직원 API: 등록(F3), 목록·상세·수정(F4), 퇴사 처리와 취소(F5, T2 의 "퇴사 처리 즉시 세션 삭제").
 */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
@Import(AdminEmployeeTest.ClockOverride.class)
class AdminEmployeeTest {

    /** KST 2026-10-01 10:00 */
    static final Instant NOW = Instant.parse("2026-10-01T01:00:00Z");
    static final String ADMIN_ID = "test-admin";
    static final String ADMIN_PASSWORD = "test-password";

    @TestConfiguration
    static class ClockOverride {
        @Bean
        @Primary
        MutableClock mutableClock() {
            return new MutableClock(NOW, ClockConfig.KST);
        }
    }

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired MutableClock clock;
    @Autowired PlatformTransactionManager transactionManager;

    ApiSession admin;
    final List<String> createdLoginIds = new ArrayList<>();

    @BeforeEach
    void setUp() throws Exception {
        clock.set(NOW);
        jdbc.update("INSERT INTO account (login_id, password_hash, role) VALUES (?, ?, 'ADMIN')",
                ADMIN_ID, passwordEncoder.encode(ADMIN_PASSWORD));
        admin = ApiSession.login(mockMvc, ADMIN_ID, ADMIN_PASSWORD);
    }

    /** 세션 행은 테스트 트랜잭션과 따로 커밋되므로 별도 트랜잭션으로 지운다. */
    @AfterEach
    void cleanUpSessions() {
        TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
        requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        List<String> loginIds = new ArrayList<>(createdLoginIds);
        loginIds.add(ADMIN_ID);
        requiresNew.executeWithoutResult(status -> loginIds.forEach(id ->
                jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", id)));
    }

    @Test
    void 등록하면_사번이_발급되고_임시_비밀번호로_로그인할_수_있다() throws Exception {
        MvcResult created = register("{\"lastName\":\"남궁\",\"firstName\":\"민\",\"birthDate\":\"1999-01-02\"}")
                .andExpect(status().isCreated())
                .andExpect(header().string("Cache-Control", "no-store"))
                .andExpect(jsonPath("$.employee.fullName").value("남궁민"))
                .andExpect(jsonPath("$.employee.status").value("ACTIVE"))
                .andReturn();
        String employeeNo = JsonPath.read(created.getResponse().getContentAsString(), "$.loginId");
        String temporaryPassword = JsonPath.read(created.getResponse().getContentAsString(), "$.temporaryPassword");
        createdLoginIds.add(employeeNo);

        assertThat(employeeNo).matches("EMP-\\d{3,}");
        assertThat(temporaryPassword).hasSize(16);
        // 상세 조회에는 임시 비밀번호가 없다(한 번만 보여 준다)
        admin.send(get("/api/admin/employees/" + employeeNo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.temporaryPassword").doesNotExist())
                .andExpect(jsonPath("$.loginId").value(employeeNo));

        ApiSession.login(mockMvc, employeeNo, temporaryPassword)
                .send(get("/api/auth/me"))
                .andExpect(jsonPath("$.employeeNo").value(employeeNo));
    }

    @Test
    void 목록은_동명이인을_사번과_생년월일로_구분할_수_있게_준다() throws Exception {
        admin.send(get("/api/admin/employees"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].employeeNo").value("EMP-001"))
                .andExpect(jsonPath("$[0].birthDate").value("1990-03-15"))
                .andExpect(jsonPath("$[1].employeeNo").value("EMP-002"))
                .andExpect(jsonPath("$[1].birthDate").value("1994-11-02"))
                .andExpect(jsonPath("$[*].employeeNo", hasItem("EMP-007")));
    }

    @Test
    void 수정하면_성명을_성과_이름으로_다시_만든다() throws Exception {
        admin.send(patch("/api/admin/employees/EMP-004").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lastName\":\"황\",\"firstName\":\"보라온\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("황보라온"))
                .andExpect(jsonPath("$.lastName").value("황"))
                .andExpect(jsonPath("$.firstName").value("보라온"));
    }

    @Test
    void 잘못된_입력은_400() throws Exception {
        register("{\"lastName\":\"김 \",\"firstName\":\"솔\"}").andExpect(status().isBadRequest());
        register("{\"lastName\":\"김\",\"firstName\":\"솔\",\"birthDate\":\"2026-10-02\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("BIRTH_DATE_IN_FUTURE"));
        admin.send(get("/api/admin/employees/EMP-999")).andExpect(status().isNotFound());
    }

    @Test
    void 오늘로_퇴사_처리하면_그_직원의_세션_행이_즉시_지워지고_다음_요청이_막힌다() throws Exception {
        String[] account = registerAndGetCredentials();
        ApiSession employee = ApiSession.login(mockMvc, account[0], account[1]);

        admin.send(put("/api/admin/employees/" + account[0] + "/access-block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BLOCKED"))
                .andExpect(jsonPath("$.accessBlockedOn").value("2026-10-01"));

        // 직원이 다음 요청을 보내기 전에 이미 세션 행이 없다
        assertThat(jdbc.queryForObject("SELECT count(*) FROM spring_session WHERE session_id = ?",
                Integer.class, employee.sessionId())).isZero();
        employee.send(get("/api/auth/me")).andExpect(status().isUnauthorized());
    }

    @Test
    void 미래_날짜로_예약하면_그날까지는_접근되고_KST_자정부터_막힌다() throws Exception {
        String[] account = registerAndGetCredentials();
        ApiSession employee = ApiSession.login(mockMvc, account[0], account[1]);

        admin.send(put("/api/admin/employees/" + account[0] + "/access-block").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"blockedOn\":\"2026-10-02\"}"))
                .andExpect(jsonPath("$.status").value("BLOCK_SCHEDULED"));
        employee.send(get("/api/auth/me")).andExpect(status().isOk());

        clock.set(Instant.parse("2026-10-01T15:00:00Z")); // KST 10/2 00:00
        employee.send(get("/api/auth/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_BLOCKED"));
    }

    @Test
    void 차단을_취소하면_다시_로그인할_수_있다() throws Exception {
        String[] account = registerAndGetCredentials();
        admin.send(put("/api/admin/employees/" + account[0] + "/access-block")).andExpect(status().isOk());

        admin.send(delete("/api/admin/employees/" + account[0] + "/access-block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACTIVE"))
                .andExpect(jsonPath("$.accessBlockedOn").doesNotExist());
        ApiSession.login(mockMvc, account[0], account[1]).send(get("/api/auth/me")).andExpect(status().isOk());
    }

    @Test
    void 계정이_없는_시드_직원도_퇴사_처리할_수_있다() throws Exception {
        admin.send(put("/api/admin/employees/EMP-005/access-block"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("BLOCKED"))
                .andExpect(jsonPath("$.loginId").doesNotExist());
    }

    @Test
    void 직원은_직원을_등록할_수_없다() throws Exception {
        String[] account = registerAndGetCredentials();
        ApiSession.login(mockMvc, account[0], account[1])
                .send(post("/api/admin/employees").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lastName\":\"김\",\"firstName\":\"솔\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN"));
    }

    // ---- helpers ----

    private org.springframework.test.web.servlet.ResultActions register(String json) throws Exception {
        return admin.send(post("/api/admin/employees").contentType(MediaType.APPLICATION_JSON).content(json));
    }

    /** [loginId, temporaryPassword] */
    private String[] registerAndGetCredentials() throws Exception {
        String body = register("{\"lastName\":\"테\",\"firstName\":\"스트\",\"birthDate\":\"1990-01-01\"}")
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
        String loginId = JsonPath.read(body, "$.loginId");
        createdLoginIds.add(loginId);
        return new String[]{loginId, JsonPath.read(body, "$.temporaryPassword")};
    }
}
