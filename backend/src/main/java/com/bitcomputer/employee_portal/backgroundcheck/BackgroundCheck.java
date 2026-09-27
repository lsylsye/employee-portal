package com.bitcomputer.employee_portal.backgroundcheck;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.employee.Employee;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;

/** 신원조회 요청과 결과. 흐름과 상태 의미는 V7__background_check.sql 주석 참고. */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class BackgroundCheck {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    private String checkId;

    @Enumerated(EnumType.STRING)
    private BackgroundCheckStatus status;

    private Boolean criminalRecord;
    private Boolean educationVerified;
    private Boolean employmentVerified;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "requested_by")
    private Account requestedBy;

    private Instant requestedAt;
    private Instant completedAt;
    private int pollCount;
    private Instant lastPolledAt;
    private String failureReason;

    /** 1단계: 외부 POST 전에 만든다. 같은 직원의 PENDING 이 있으면 조건부 유니크에 걸린다. */
    public static BackgroundCheck pending(Employee employee, Account requestedBy, Instant now) {
        BackgroundCheck check = new BackgroundCheck();
        check.employee = employee;
        check.requestedBy = requestedBy;
        check.status = BackgroundCheckStatus.PENDING;
        check.requestedAt = now;
        return check;
    }
}
