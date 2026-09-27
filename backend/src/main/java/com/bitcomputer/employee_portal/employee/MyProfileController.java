package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.auth.AccountPrincipal;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * 직원 본인 API. 경로에 id 를 받지 않고 세션의 사번으로 본인을 찾는다(N3, IDOR 방지).
 * 관리자 계정은 직원 레코드가 없어서 404 다.
 */
@RestController
@RequestMapping("/api/me/profile")
@RequiredArgsConstructor
public class MyProfileController {

    private final EmployeeRepository employeeRepository;

    public record Profile(String employeeNo, String fullName, LocalDate birthDate,
                          String phone, String email, String address, String emergencyContact) {
        static Profile of(Employee e) {
            return new Profile(e.getEmployeeNo(), e.getFullName(), e.getBirthDate(),
                    e.getPhone(), e.getEmail(), e.getAddress(), e.getEmergencyContact());
        }
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Profile get(@AuthenticationPrincipal AccountPrincipal principal) {
        return Profile.of(me(principal));
    }

    private Employee me(AccountPrincipal principal) {
        if (principal.getEmployeeNo() == null) {
            throw new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND);
        }
        return employeeRepository.findByEmployeeNo(principal.getEmployeeNo())
                .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }
}
