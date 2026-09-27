package com.bitcomputer.employee_portal.employee;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

/** 관리자 직원 API 의 요청·응답 */
public final class AdminEmployeeDto {

    private AdminEmployeeDto() {
    }

    /** 이름에는 공백을 허용하지 않는다(성명 = 성 + 이름으로 합치기 때문). */
    static final String NO_WHITESPACE = "\\S+";

    /** 목록. 동명이인(EMP-001/002)을 구분할 수 있게 사번·생년월일을 함께 준다. */
    public record Summary(String employeeNo, String fullName, LocalDate birthDate,
                          EmploymentStatus status, LocalDate accessBlockedOn) {
        static Summary of(Employee e, LocalDate today) {
            return new Summary(e.getEmployeeNo(), e.getFullName(), e.getBirthDate(), e.statusOn(today), e.getAccessBlockedOn());
        }
    }

    public record Detail(String employeeNo, String fullName, String lastName, String firstName, LocalDate birthDate,
                         String phone, String email, String address, String emergencyContact,
                         EmploymentStatus status, LocalDate accessBlockedOn, String loginId) {
        static Detail of(Employee e, String loginId, LocalDate today) {
            return new Detail(e.getEmployeeNo(), e.getFullName(), e.getLastName(), e.getFirstName(), e.getBirthDate(),
                    e.getPhone(), e.getEmail(), e.getAddress(), e.getEmergencyContact(),
                    e.statusOn(today), e.getAccessBlockedOn(), loginId);
        }
    }

    /** 생년월일은 비워 둘 수 있다(확인되지 않은 경우. BG 실행은 막힌다). */
    public record CreateRequest(
            @NotNull @Size(min = 1, max = 20) @Pattern(regexp = NO_WHITESPACE) String lastName,
            @NotNull @Size(min = 1, max = 30) @Pattern(regexp = NO_WHITESPACE) String firstName,
            LocalDate birthDate,
            @Size(max = 20) String phone,
            @Email @Size(max = 100) String email,
            @Size(max = 200) String address,
            @Size(max = 100) String emergencyContact) {
    }

    /** 임시 비밀번호는 이 응답에만 한 번 담는다. 다시 조회할 수 없다. */
    public record Created(Detail employee, String loginId, String temporaryPassword) {
    }

    /** null 인 필드는 바꾸지 않는다. */
    public record UpdateRequest(
            @Size(min = 1, max = 20) @Pattern(regexp = NO_WHITESPACE) String lastName,
            @Size(min = 1, max = 30) @Pattern(regexp = NO_WHITESPACE) String firstName,
            LocalDate birthDate,
            @Size(max = 20) String phone,
            @Email @Size(max = 100) String email,
            @Size(max = 200) String address,
            @Size(max = 100) String emergencyContact) {
        Employee.Contact contact() {
            return new Employee.Contact(phone, email, address, emergencyContact);
        }
    }

    /** blockedOn 을 비우면 오늘(KST)이다. 그날 00:00 KST 부터 차단된다. */
    public record AccessBlockRequest(LocalDate blockedOn) {
    }
}
