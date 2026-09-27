package com.bitcomputer.employee_portal.backgroundcheck;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BackgroundCheckRepository extends JpaRepository<BackgroundCheck, Long> {

    /** 폴링 대상(부분 인덱스 background_check_pending_idx) */
    List<BackgroundCheck> findByStatusOrderByRequestedAt(BackgroundCheckStatus status);

    /** 직원별 이력(인덱스 employee_id, requested_at DESC) */
    List<BackgroundCheck> findByEmployeeIdOrderByRequestedAtDesc(Long employeeId);

    /** 상세: 보관 기간 판단에 직원(차단일)이 필요하다 */
    @EntityGraph(attributePaths = "employee")
    Optional<BackgroundCheck> findWithEmployeeById(Long id);
}
