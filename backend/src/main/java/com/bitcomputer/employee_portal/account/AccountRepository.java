package com.bitcomputer.employee_portal.account;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AccountRepository extends JpaRepository<Account, Long> {

    Optional<Account> findByLoginId(String loginId);

    boolean existsByLoginId(String loginId);

    /** 접근 판단에 직원(차단일)이 필요하다. open-in-view 를 끄므로 함께 읽는다. */
    @EntityGraph(attributePaths = "employee")
    Optional<Account> findWithEmployeeByLoginId(String loginId);
}
