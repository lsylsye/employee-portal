package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.account.Account;
import jakarta.persistence.Entity;
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

/** 직원 정보 변경 사실(누가·언제·누구의·어떤 필드). 값은 남기지 않는다. 판단 (4). */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EmployeeChangeLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "employee_id")
    private Employee employee;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "changed_by")
    private Account changedBy;

    private String fieldName;

    private Instant changedAt;

    EmployeeChangeLog(Employee employee, Account changedBy, String fieldName, Instant changedAt) {
        this.employee = employee;
        this.changedBy = changedBy;
        this.fieldName = fieldName;
        this.changedAt = changedAt;
    }
}
