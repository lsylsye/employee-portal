package com.bitcomputer.employee_portal.account;

import com.bitcomputer.employee_portal.employee.Employee;
import org.junit.jupiter.api.Test;
import org.springframework.beans.BeanUtils;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 계정 접근 판단(fail-closed) 규칙. 요청 단위의 차단(T2)은 로그인 구현과 함께 따로 검증한다.
 */
class AccountAccessTest {

    static final LocalDate BLOCKED_ON = LocalDate.of(2026, 10, 1);

    @Test
    void 차단일_전날까지는_허용된다() {
        Account account = employeeAccount(BLOCKED_ON);

        assertThat(account.isAccessAllowedOn(BLOCKED_ON.minusDays(1))).isTrue();
    }

    @Test
    void 차단일_당일부터_거부된다() {
        Account account = employeeAccount(BLOCKED_ON);

        assertThat(account.isAccessAllowedOn(BLOCKED_ON)).isFalse();
        assertThat(account.isAccessAllowedOn(BLOCKED_ON.plusDays(1))).isFalse();
    }

    @Test
    void 차단일이_없으면_허용된다() {
        assertThat(employeeAccount(null).isAccessAllowedOn(BLOCKED_ON)).isTrue();
    }

    @Test
    void 직원과_연결되지_않은_관리자는_허용된다() {
        assertThat(Account.admin("admin", "hash").isAccessAllowedOn(BLOCKED_ON)).isTrue();
    }

    @Test
    void 직원과_연결되지_않은_일반_계정은_거부된다() {
        // DB 제약(account_role_ck)으로는 생길 수 없는 상태지만, 코드도 통과시키지 않는다.
        Account broken = Account.admin("broken", "hash");
        ReflectionTestUtils.setField(broken, "role", Role.EMPLOYEE);

        assertThat(broken.isAccessAllowedOn(BLOCKED_ON)).isFalse();
    }

    private static Account employeeAccount(LocalDate accessBlockedOn) {
        Employee employee = BeanUtils.instantiateClass(Employee.class);
        ReflectionTestUtils.setField(employee, "employeeNo", "EMP-999");
        ReflectionTestUtils.setField(employee, "accessBlockedOn", accessBlockedOn);
        return Account.employee(employee, "hash");
    }
}
