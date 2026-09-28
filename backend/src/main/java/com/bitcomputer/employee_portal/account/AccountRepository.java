package com.bitcomputer.employee_portal.account;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {

    /** 비밀번호 변경용: 같은 계정의 동시 변경을 직렬화하려고 행 잠금(SELECT ... FOR UPDATE)으로 읽는다. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Account a where a.loginId = :loginId")
    Optional<Account> findForPasswordChange(@Param("loginId") String loginId);

    Optional<Account> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);

    Optional<Account> findByEmployeeId(Long employeeId);

    /** 접근 판단에 직원(차단일)이 필요하다. open-in-view 를 끄므로 함께 읽는다. */
    @EntityGraph(attributePaths = "employee")
    Optional<Account> findWithEmployeeByLoginId(String loginId);
}
