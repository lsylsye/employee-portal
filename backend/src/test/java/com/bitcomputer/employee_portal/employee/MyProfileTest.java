package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.support.ApiSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 직원 본인 API(F2). T1 의 "직원은 본인 정보만" 부분. */
@SpringBootTest
@AutoConfigureMockMvc
@Transactional
class MyProfileTest {

    static final String PASSWORD = "test-password";
    static final String EMPLOYEE_ID = "EMP-008";
    static final String ADMIN_ID = "test-admin";

    @Autowired MockMvc mockMvc;
    @Autowired JdbcTemplate jdbc;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired PlatformTransactionManager transactionManager;

    @BeforeEach
    void setUp() {
        String hash = passwordEncoder.encode(PASSWORD);
        jdbc.update("INSERT INTO account (login_id, password_hash, role, employee_id) "
                + "SELECT ?, ?, 'EMPLOYEE', id FROM employee WHERE employee_no = ?", EMPLOYEE_ID, hash, EMPLOYEE_ID);
        jdbc.update("INSERT INTO account (login_id, password_hash, role) VALUES (?, ?, 'ADMIN')", ADMIN_ID, hash);
    }

    @AfterEach
    void cleanUpSessions() {
        TransactionTemplate requiresNew = new TransactionTemplate(transactionManager);
        requiresNew.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        requiresNew.executeWithoutResult(status -> jdbc.update(
                "DELETE FROM spring_session WHERE principal_name IN (?, ?)", EMPLOYEE_ID, ADMIN_ID));
    }

    @Test
    void 직원은_세션의_사번으로_본인_정보를_조회한다() throws Exception {
        ApiSession.login(mockMvc, EMPLOYEE_ID, PASSWORD)
                .send(get("/api/me/profile"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.employeeNo").value("EMP-008"))
                .andExpect(jsonPath("$.fullName").value("박민준"))
                .andExpect(jsonPath("$.accessBlockedOn").doesNotExist());
    }

    @Test
    void 직원은_관리자_API로_다른_직원을_조회할_수_없다() throws Exception {
        ApiSession.login(mockMvc, EMPLOYEE_ID, PASSWORD)
                .send(get("/api/admin/employees/EMP-001"))
                .andExpect(status().isForbidden());
    }

    @Test
    void 관리자는_직원_레코드가_없어서_본인_정보가_404() throws Exception {
        ApiSession.login(mockMvc, ADMIN_ID, PASSWORD)
                .send(get("/api/me/profile"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("EMPLOYEE_NOT_FOUND"));
    }

    @Test
    void 본인_연락처_수정은_즉시_반영되고_바뀐_필드만_기록된다() throws Exception {
        ApiSession me = ApiSession.login(mockMvc, EMPLOYEE_ID, PASSWORD);
        me.send(patch("/api/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"010-1111-2222\",\"email\":\"park@example.com\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.phone").value("010-1111-2222"));
        // 같은 값으로 다시 보내면 바뀐 것이 없으므로 기록하지 않는다
        me.send(patch("/api/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"phone\":\"010-1111-2222\"}"))
                .andExpect(status().isOk());

        assertThat(jdbc.queryForList(
                "SELECT l.field_name FROM employee_change_log l JOIN employee e ON e.id = l.employee_id "
                        + "JOIN account a ON a.id = l.changed_by "
                        + "WHERE e.employee_no = ? AND a.login_id = ? ORDER BY l.id", String.class, EMPLOYEE_ID, EMPLOYEE_ID))
                .containsExactly("phone", "email");
    }

    @Test
    void 본인은_성명과_생년월일을_바꿀_수_없다() throws Exception {
        ApiSession.login(mockMvc, EMPLOYEE_ID, PASSWORD)
                .send(patch("/api/me/profile").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"lastName\":\"김\",\"birthDate\":\"2000-01-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("박민준"))
                .andExpect(jsonPath("$.birthDate").value("1993-08-17"));
    }

    @Test
    void 변경_기록_테이블에는_값을_담는_컬럼이_없다() {
        assertThat(jdbc.queryForList("SELECT column_name FROM information_schema.columns "
                + "WHERE table_name = 'employee_change_log' ORDER BY ordinal_position", String.class))
                .containsExactly("id", "employee_id", "changed_by", "field_name", "changed_at");
    }

    @Test
    void 로그인하지_않으면_401() throws Exception {
        mockMvc.perform(get("/api/me/profile")).andExpect(status().isUnauthorized());
    }
}
