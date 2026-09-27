package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.AccessBlockRequest;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.CreateRequest;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Created;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Detail;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Summary;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.UpdateRequest;
import com.bitcomputer.employee_portal.auth.AccountPrincipal;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** 관리자 전용(/api/admin/** 는 SecurityConfig 에서 ADMIN 만 허용). 직원은 사번으로 가리킨다. */
@RestController
@RequestMapping("/api/admin/employees")
@RequiredArgsConstructor
public class AdminEmployeeController {

    private final AdminEmployeeService adminEmployeeService;

    @GetMapping
    List<Summary> list() {
        return adminEmployeeService.list();
    }

    /** 응답에 임시 비밀번호가 담긴다. 캐시되지 않게 한다. */
    @PostMapping
    ResponseEntity<Created> create(@Valid @RequestBody CreateRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(adminEmployeeService.create(request));
    }

    @GetMapping("/{employeeNo}")
    Detail get(@PathVariable String employeeNo) {
        return adminEmployeeService.get(employeeNo);
    }

    @PatchMapping("/{employeeNo}")
    Detail update(@PathVariable String employeeNo, @Valid @RequestBody UpdateRequest request,
                  @AuthenticationPrincipal AccountPrincipal principal) {
        return adminEmployeeService.update(employeeNo, request, principal.getLoginId());
    }

    /** 퇴사 처리. 본문을 비우면 오늘(KST)부터 차단한다. */
    @PutMapping("/{employeeNo}/access-block")
    Detail blockAccess(@PathVariable String employeeNo, @RequestBody(required = false) AccessBlockRequest request,
                       @AuthenticationPrincipal AccountPrincipal principal) {
        return adminEmployeeService.blockAccess(employeeNo, request, principal.getLoginId());
    }

    /** 차단 취소(오입력 정정) */
    @DeleteMapping("/{employeeNo}/access-block")
    Detail cancelAccessBlock(@PathVariable String employeeNo, @AuthenticationPrincipal AccountPrincipal principal) {
        return adminEmployeeService.cancelAccessBlock(employeeNo, principal.getLoginId());
    }
}
