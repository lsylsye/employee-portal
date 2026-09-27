package com.bitcomputer.employee_portal.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 인사 레코드. 로그인 수단은 {@link com.bitcomputer.employee_portal.account.Account} 가 따로 가진다.
 * 성·이름은 문자열 규칙으로 나누지 않고 저장된 값을 쓴다(복성 때문). lastName = 성.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeNo;
    private String fullName;
    private String lastName;
    private String firstName;

    /** 확인되지 않았으면 null (EMP-007). BG 요청을 만들 수 없다. */
    private LocalDate birthDate;

    private String phone;
    private String email;
    private String address;
    private String emergencyContact;

    /** 접근 차단일(퇴사일). 이 날 00:00 KST 부터 차단한다. null 이면 재직 중. */
    private LocalDate accessBlockedOn;

    @Column(insertable = false, updatable = false)
    private Instant createdAt;

    @Column(insertable = false)
    private Instant updatedAt;

    /**
     * today 는 KST 기준 날짜여야 한다(Clock 주입). 차단일 당일 00:00 부터 차단이므로 당일도 포함한다.
     */
    public boolean isAccessBlockedOn(LocalDate today) {
        return accessBlockedOn != null && !today.isBefore(accessBlockedOn);
    }
}
