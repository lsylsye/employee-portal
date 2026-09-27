package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.auth.AccountPrincipal;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Clock;
import java.time.Instant;
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
    private final EmployeeChangeRecorder changeRecorder;
    private final Clock clock;

    public record Profile(String employeeNo, String fullName, LocalDate birthDate,
                          String phone, String email, String address, String emergencyContact) {
        static Profile of(Employee e) {
            return new Profile(e.getEmployeeNo(), e.getFullName(), e.getBirthDate(),
                    e.getPhone(), e.getEmail(), e.getAddress(), e.getEmergencyContact());
        }
    }

    /**
     * 본인이 고칠 수 있는 필드만 받는다. 성명·생년월일은 BG 입력값이라 관리자만 고친다(F-b).
     * 이 요청에 없는 필드(lastName 등)를 보내도 무시된다. null 인 필드는 바꾸지 않는다.
     */
    public record ContactUpdateRequest(
            @Size(max = 20) String phone,
            @Email @Size(max = 100) String email,
            @Size(max = 200) String address,
            @Size(max = 100) String emergencyContact) {
    }

    @GetMapping
    @Transactional(readOnly = true)
    public Profile get(@AuthenticationPrincipal AccountPrincipal principal) {
        return Profile.of(me(principal));
    }

    /** 판단 (4): 즉시 반영하고, 누가·언제·어떤 필드를 바꿨는지만 기록한다. */
    @PatchMapping
    @Transactional
    public Profile update(@AuthenticationPrincipal AccountPrincipal principal,
                          @Valid @RequestBody ContactUpdateRequest request) {
        Employee employee = me(principal);
        Instant now = clock.instant();
        var changed = employee.updateContact(new Employee.Contact(
                request.phone(), request.email(), request.address(), request.emergencyContact()), now);
        changeRecorder.record(employee, principal.getLoginId(), changed, now);
        return Profile.of(employee);
    }

    private Employee me(AccountPrincipal principal) {
        if (principal.getEmployeeNo() == null) {
            throw new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND);
        }
        return employeeRepository.findByEmployeeNo(principal.getEmployeeNo())
                .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }
}
