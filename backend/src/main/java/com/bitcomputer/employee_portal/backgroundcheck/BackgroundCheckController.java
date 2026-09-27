package com.bitcomputer.employee_portal.backgroundcheck;

import com.bitcomputer.employee_portal.auth.AccountPrincipal;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.Detail;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.HistoryItem;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.MyItem;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** /api/admin/** 는 ADMIN 만(SecurityConfig). /api/me/** 는 세션의 사번으로 본인만. */
@RestController
@RequiredArgsConstructor
public class BackgroundCheckController {

    private final BackgroundCheckService backgroundCheckService;

    /** 실행. 202: 결과는 백그라운드 폴링이 채운다. 진행 중이면 409, 퇴사자·생년월일 없음은 422. */
    @PostMapping("/api/admin/employees/{employeeNo}/background-checks")
    ResponseEntity<HistoryItem> request(@PathVariable String employeeNo, @AuthenticationPrincipal AccountPrincipal principal) {
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(backgroundCheckService.request(employeeNo, principal.getLoginId()));
    }

    @GetMapping("/api/admin/employees/{employeeNo}/background-checks")
    List<HistoryItem> history(@PathVariable String employeeNo) {
        return backgroundCheckService.history(employeeNo);
    }

    /** 민감정보(범죄 기록 등). 브라우저·프록시 캐시에 남지 않게 한다. */
    @GetMapping("/api/admin/background-checks/{id}")
    ResponseEntity<Detail> detail(@PathVariable Long id) {
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(backgroundCheckService.detail(id));
    }

    @GetMapping("/api/me/background-checks")
    List<MyItem> mine(@AuthenticationPrincipal AccountPrincipal principal) {
        if (principal.getEmployeeNo() == null) {
            throw new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND);
        }
        return backgroundCheckService.mine(principal.getEmployeeNo());
    }
}
