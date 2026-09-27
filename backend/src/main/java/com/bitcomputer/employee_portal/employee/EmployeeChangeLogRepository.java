package com.bitcomputer.employee_portal.employee;

import org.springframework.data.jpa.repository.JpaRepository;

public interface EmployeeChangeLogRepository extends JpaRepository<EmployeeChangeLog, Long> {
}
