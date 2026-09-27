package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.support.ApiSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
    void 로그인하지_않으면_401() throws Exception {
        mockMvc.perform(get("/api/me/profile")).andExpect(status().isUnauthorized());
    }
}
