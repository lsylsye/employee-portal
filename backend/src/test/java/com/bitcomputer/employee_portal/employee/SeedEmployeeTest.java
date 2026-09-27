package com.bitcomputer.employee_portal.employee;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * T3 (이 브랜치 몫): Flyway 시드 10명의 성·이름·생년월일이 기대표(docs/requirements.md §1)와 같은지 본다.
 * BG 요청으로의 변환은 feat/background-check 에서 변환 코드와 함께 검증한다.
 */
@SpringBootTest
class SeedEmployeeTest {

    @Autowired
    EmployeeRepository employeeRepository;

    @Test
    void 시드는_10명이다() {
        assertThat(employeeRepository.count()).isEqualTo(10);
    }

    @ParameterizedTest(name = "{0} {1} → 성 {2} / 이름 {3}")
    @CsvSource(nullValues = "null", value = {
            "EMP-001, 김민준,   김,   민준, 1990-03-15",   // 동명이인
            "EMP-002, 김민준,   김,   민준, 1994-11-02",   // 동명이인
            "EMP-003, 남궁서준, 남궁, 서준, 1988-07-21",   // 복성
            "EMP-004, 황보라온, 황보, 라온, 1995-02-09",   // 복성으로 판단
            "EMP-005, 김솔,     김,   솔,   1992-12-30",   // 외자
            "EMP-006, 선우진,   선우, 진,   1991-05-05",   // 복성으로 판단 + 외자
            "EMP-007, 이서연,   이,   서연, null",         // 생년월일 미확인
            "EMP-008, 박민준,   박,   민준, 1993-08-17",
            "EMP-009, 최지우,   최,   지우, 1996-04-03",
            "EMP-010, 정하윤,   정,   하윤, 1989-10-11",
    })
    void 시드_성명_분리(String employeeNo, String fullName, String lastName, String firstName, LocalDate birthDate) {
        Employee employee = employeeRepository.findByEmployeeNo(employeeNo).orElseThrow();

        assertThat(employee.getFullName()).isEqualTo(fullName);
        assertThat(employee.getLastName()).isEqualTo(lastName);
        assertThat(employee.getFirstName()).isEqualTo(firstName);
        assertThat(employee.getBirthDate()).isEqualTo(birthDate);
    }
}
