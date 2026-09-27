package com.bitcomputer.employee_portal.account;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;

import static org.assertj.core.api.Assertions.assertThat;

/** 테스트 DB 전용 값. 기동할 때마다 실행되므로 두 번째 실행부터는 "이미 있으면 건너뜀"도 함께 검증된다. */
@SpringBootTest(properties = {
        "ADMIN_PASSWORD=test-admin-pw",
        "SUBMISSION_EMPLOYEE_NO=EMP-003",
        "SUBMISSION_EMPLOYEE_PASSWORD=test-employee-pw",
})
class SubmissionAccountInitializerTest {

    @Autowired
    AccountRepository accountRepository;

    @Autowired
    PasswordEncoder passwordEncoder;

    @Test
    void 관리자_계정은_직원_레코드_없이_만들어진다() {
        Account admin = accountRepository.findByLoginId("admin").orElseThrow();

        assertThat(admin.getRole()).isEqualTo(Role.ADMIN);
        assertThat(admin.getEmployee()).isNull();
        assertThat(passwordEncoder.matches("test-admin-pw", admin.getPasswordHash())).isTrue();
    }

    @Test
    void 직원_계정은_사번을_아이디로_쓴다() {
        Account employee = accountRepository.findByLoginId("EMP-003").orElseThrow();

        assertThat(employee.getRole()).isEqualTo(Role.EMPLOYEE);
        assertThat(passwordEncoder.matches("test-employee-pw", employee.getPasswordHash())).isTrue();
        assertThat(employee.getPasswordHash()).doesNotContain("test-employee-pw");
    }
}
