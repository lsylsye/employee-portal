package com.bitcomputer.employee_portal.employee;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByEmployeeNo(String employeeNo);

    /**
     * 관리자 목록: 직원별 최신 신원조회 상태를 한 번의 쿼리로 가져온다(N+1 없음, 비정규화 없음).
     * DISTINCT ON 으로 직원마다 requested_at 이 가장 늦은 1건만 남긴다(인덱스 employee_id, requested_at DESC).
     * 보관 기간이 지난 직원(차단일 <= retentionCutoff)의 결과는 붙이지 않는다.
     */
    @Query(value = """
            SELECT e.employee_no AS employeeNo, e.full_name AS fullName, e.birth_date AS birthDate,
                   e.access_blocked_on AS accessBlockedOn,
                   latest.status AS latestCheckStatus, latest.requested_at AS latestCheckRequestedAt
              FROM employee e
              LEFT JOIN (SELECT DISTINCT ON (employee_id) employee_id, status, requested_at
                           FROM background_check
                          ORDER BY employee_id, requested_at DESC) latest
                ON latest.employee_id = e.id
               AND (e.access_blocked_on IS NULL OR e.access_blocked_on > :retentionCutoff)
             ORDER BY e.employee_no
            """, nativeQuery = true)
    List<EmployeeListRow> findAllWithLatestCheck(LocalDate retentionCutoff);

    /** 새 사번. 번호는 시퀀스(V5)에서 받는다. 동시에 등록해도 겹치지 않는다. */
    default String nextEmployeeNo() {
        return formatEmployeeNo(nextEmployeeNoValue());
    }

    @Query(value = "SELECT nextval('employee_no_seq')", nativeQuery = true)
    long nextEmployeeNoValue();

    /** 'EMP-' + 3자리 0 채움. 1000 이상은 자릿수가 늘어난다(잘리지 않는다). */
    static String formatEmployeeNo(long value) {
        return "EMP-%03d".formatted(value);
    }
}
