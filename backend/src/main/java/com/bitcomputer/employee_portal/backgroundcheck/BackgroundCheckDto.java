package com.bitcomputer.employee_portal.backgroundcheck;

import java.time.Instant;

public final class BackgroundCheckDto {

    private BackgroundCheckDto() {
    }

    /** 이력 한 줄. 판정만 준다(상세 결과는 Detail 에서만). */
    public record HistoryItem(Long id, BackgroundCheckStatus status, Instant requestedAt, Instant completedAt,
                              String failureReason) {
        static HistoryItem of(BackgroundCheck c) {
            return new HistoryItem(c.getId(), c.getStatus(), c.getRequestedAt(), c.getCompletedAt(), c.getFailureReason());
        }
    }

    /** 상세 결과. creditScore 는 수집하지 않는다(최소 수집). */
    public record Detail(Long id, String employeeNo, String fullName, BackgroundCheckStatus status,
                         Instant requestedAt, Instant completedAt,
                         Boolean criminalRecord, Boolean educationVerified, Boolean employmentVerified,
                         String failureReason) {
        static Detail of(BackgroundCheck c) {
            return new Detail(c.getId(), c.getEmployee().getEmployeeNo(), c.getEmployee().getFullName(), c.getStatus(),
                    c.getRequestedAt(), c.getCompletedAt(),
                    c.getCriminalRecord(), c.getEducationVerified(), c.getEmploymentVerified(), c.getFailureReason());
        }
    }

    /** 직원 본인용: 조회 일자와 진행 상태만. 판정·결과는 주지 않는다(DECISIONS (3), b안). */
    public record MyItem(Instant requestedAt, Progress progress) {
        static MyItem of(BackgroundCheck c) {
            Progress progress = switch (c.getStatus()) {
                case PENDING -> Progress.IN_PROGRESS;
                case CLEAR, FLAGGED -> Progress.COMPLETED;
                case UNRESOLVED, FAILED -> Progress.NOT_COMPLETED;
            };
            return new MyItem(c.getRequestedAt(), progress);
        }
    }

    public enum Progress {
        IN_PROGRESS,
        COMPLETED,
        /** 시스템 사정으로 끝나지 못함. 판정(FLAGGED 등)과 구분되지 않게 묶는다. */
        NOT_COMPLETED
    }
}
