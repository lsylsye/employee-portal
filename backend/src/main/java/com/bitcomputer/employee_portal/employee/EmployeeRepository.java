package com.bitcomputer.employee_portal.employee;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.Optional;

public interface EmployeeRepository extends JpaRepository<Employee, Long> {

    Optional<Employee> findByEmployeeNo(String employeeNo);

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
