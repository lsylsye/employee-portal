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
 * 로그인 계정. 접근 통제(퇴사 차단)는 계정 단위로 한다.
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

    /** 이 날 00:00 KST 부터 차단한다. null 이면 재직 중. */
    private LocalDate accessBlockedOn;

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

    /** 직원 계정의 아이디는 사번이다(F-d). */
    public static Account employee(Employee employee, String passwordHash) {
        return new Account(employee.getEmployeeNo(), passwordHash, Role.EMPLOYEE, employee);
    }

    /**
     * today 는 KST 기준 날짜여야 한다(Clock 주입). 차단일 당일 00:00 부터 차단이므로 당일도 포함한다.
     */
    public boolean isAccessBlockedOn(LocalDate today) {
        return accessBlockedOn != null && !today.isBefore(accessBlockedOn);
    }
}
