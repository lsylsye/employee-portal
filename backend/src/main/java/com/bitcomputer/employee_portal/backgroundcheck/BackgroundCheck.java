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

import java.time.Duration;
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

    /** 2단계: 외부 POST 성공. 결과는 아직 없다(POST 응답이 최종이어도 결과 필드는 GET 으로 받는다). */
    public void attachCheckId(String checkId) {
        this.checkId = checkId;
    }

    /** 최종 상태(clear/flagged)를 받았을 때만 결과를 저장한다. creditScore 는 받지 않는다. */
    public void complete(BackgroundCheckStatus finalStatus, Boolean criminalRecord, Boolean educationVerified,
                         Boolean employmentVerified, Instant completedAt, Instant now) {
        if (!finalStatus.isFinal()) {
            throw new IllegalArgumentException("최종 상태가 아니다: " + finalStatus);
        }
        this.status = finalStatus;
        this.criminalRecord = criminalRecord;
        this.educationVerified = educationVerified;
        this.employmentVerified = employmentVerified;
        this.completedAt = completedAt != null ? completedAt : now;
        recordPoll(now);
    }

    public void recordPoll(Instant now) {
        this.pollCount++;
        this.lastPolledAt = now;
    }

    /** 결과 미확인. 외부 GET ?employeeId= 로 실제 생성 여부를 확인할 수 있다. */
    public void markUnresolved(String reason) {
        this.status = BackgroundCheckStatus.UNRESOLVED;
        this.failureReason = reason;
    }

    /** POST 가 4xx 로 확실히 거절됨. 외부에 생성되지 않았다. */
    public void markFailed(String reason) {
        this.status = BackgroundCheckStatus.FAILED;
        this.failureReason = reason;
    }

    /** 폴링할 때인가: 첫 폴링은 요청 후 firstDelay, 그 뒤로는 마지막 폴링 후 interval. */
    public boolean isPollDue(Instant now, Duration firstDelay, Duration interval) {
        Instant next = lastPolledAt == null ? requestedAt.plus(firstDelay) : lastPolledAt.plus(interval);
        return !now.isBefore(next);
    }

    public boolean isPending() {
        return status == BackgroundCheckStatus.PENDING;
    }
}
