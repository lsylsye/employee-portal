package com.bitcomputer.employee_portal.account;

import com.bitcomputer.employee_portal.employee.Employee;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 로그인 계정. 접근 차단일(퇴사일)은 인사상의 사실이라 직원이 가진다. 계정은 그 값으로 접근을 판단한다.
 * 관리자는 직원 레코드가 없고(employee = null), 직원 계정은 사번을 아이디로 쓴다.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Account {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String loginId;
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private Role role;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @Column(insertable = false, updatable = false)
    private Instant createdAt;

    private Account(String loginId, String passwordHash, Role role, Employee employee) {
        this.loginId = loginId;
        this.passwordHash = passwordHash;
        this.role = role;
        this.employee = employee;
    }

    public static Account admin(String loginId, String passwordHash) {
        return new Account(loginId, passwordHash, Role.ADMIN, null);
    }

    /** BCrypt 해시를 받는다. 검사(현재 비밀번호, 새 비밀번호 규칙)는 PasswordService 가 한다. */
    public void changePassword(String encodedPassword) {
        this.passwordHash = encodedPassword;
    }

    /** 직원 계정의 아이디는 사번이다(F-d). */
    public static Account employee(Employee employee, String passwordHash) {
        return new Account(employee.getEmployeeNo(), passwordHash, Role.EMPLOYEE, employee);
    }

    /**
     * 접근 허용 여부. 실패하면 막히는 쪽(fail-closed)으로 판단한다.
     * - 직원과 연결된 계정: 그 직원의 차단일로 판단한다.
     * - 직원과 연결되지 않은 계정: ADMIN 만 통과한다. "연결된 직원이 없으면 통과"로 두면
     *   연결이 빠진 일반 계정이 검사 없이 통과한다.
     * today 는 KST 기준 날짜여야 한다(Clock 주입).
     */
    public boolean isAccessAllowedOn(LocalDate today) {
        if (employee != null) {
            return !employee.isAccessBlockedOn(today);
        }
        return role == Role.ADMIN;
    }
}
