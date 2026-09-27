package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.account.AccountRepository;
import com.bitcomputer.employee_portal.common.ErrorCode;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Clock;
import java.time.LocalDate;

/**
 * 이미 로그인한 세션도 요청마다 DB 의 현재 상태로 다시 판단한다(DECISIONS (1)).
 * - 차단일이 오늘(KST) 이하가 되는 순간 다음 요청부터 막힌다. 예약 퇴사도 스케줄러 없이 동작한다.
 * - 계정이 사라졌거나 판단할 수 없으면 막는다(fail-closed).
 * 막으면 세션을 무효화한다(spring_session 행 삭제).
 * 빈으로 등록하지 않는다. 등록하면 Boot 가 서블릿 필터로도 한 번 더 건다.
 */
@RequiredArgsConstructor
public class AccessBlockFilter extends OncePerRequestFilter {

    private final AccountRepository accountRepository;
    private final Clock clock;

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof AccountPrincipal principal
                && !isAllowed(principal.getLoginId())) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                session.invalidate();
            }
            SecurityContextHolder.clearContext();
            ErrorCode.ACCESS_BLOCKED.write(response);
            return;
        }
        chain.doFilter(request, response);
    }

    private boolean isAllowed(String loginId) {
        LocalDate today = LocalDate.now(clock);
        return accountRepository.findWithEmployeeByLoginId(loginId)
                .map(account -> account.isAccessAllowedOn(today))
                .orElse(false);
    }
}
