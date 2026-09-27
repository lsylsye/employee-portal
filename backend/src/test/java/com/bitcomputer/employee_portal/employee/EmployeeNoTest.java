package com.bitcomputer.employee_portal.employee;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
class EmployeeNoTest {

    @Autowired
    EmployeeRepository employeeRepository;

    @Test
    void 시퀀스는_시드_다음_번호부터_겹치지_않게_발급한다() {
        String first = employeeRepository.nextEmployeeNo();
        String second = employeeRepository.nextEmployeeNo();

        assertThat(first).matches("EMP-\\d{3,}");
        assertThat(Integer.parseInt(first.substring(4))).isGreaterThanOrEqualTo(11);
        assertThat(second).isNotEqualTo(first);
    }

    @Test
    void 형식은_3자리_0_채움이고_1000부터_잘리지_않는다() {
        assertThat(EmployeeRepository.formatEmployeeNo(11)).isEqualTo("EMP-011");
        assertThat(EmployeeRepository.formatEmployeeNo(999)).isEqualTo("EMP-999");
        assertThat(EmployeeRepository.formatEmployeeNo(1000)).isEqualTo("EMP-1000");
    }
}
