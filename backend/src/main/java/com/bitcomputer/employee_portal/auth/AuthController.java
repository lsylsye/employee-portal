package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.common.ApiExceptionHandler;
import com.bitcomputer.employee_portal.common.ErrorCode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final SessionAuthenticationStrategy sessionAuthenticationStrategy;
    private final SecurityContextRepository securityContextRepository;
    private final LogoutHandler logoutHandler;

    public record LoginRequest(@NotBlank String loginId, @NotBlank String password) {
    }

    public record MeResponse(String loginId, String role, String employeeNo) {
        static MeResponse of(AccountPrincipal principal) {
            return new MeResponse(principal.getLoginId(), principal.getRole().name(), principal.getEmployeeNo());
        }
    }

    /**
     * CSRF 토큰 쿠키(XSRF-TOKEN)를 발급한다. 프론트는 쿠키 값을 X-XSRF-TOKEN 헤더로 보낸다.
     * 토큰은 지연 생성되므로 여기서 값을 꺼내 쿠키가 실리게 한다.
     */
    @GetMapping("/csrf")
    ResponseEntity<Void> csrf(CsrfToken csrfToken) {
        csrfToken.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/login")
    ResponseEntity<?> login(@Valid @RequestBody LoginRequest request,
                            HttpServletRequest httpRequest, HttpServletResponse httpResponse) {
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.loginId(), request.password()));
        } catch (AuthenticationException e) {
            // 없는 아이디, 틀린 비밀번호, 차단 모두 같은 응답이다(계정 존재·퇴사 여부를 드러내지 않는다).
            return ApiExceptionHandler.respond(ErrorCode.INVALID_CREDENTIALS);
        }
        // 세션 고정 공격 방지(세션 ID 교체)와 CSRF 토큰 교체
        sessionAuthenticationStrategy.onAuthentication(authentication, httpRequest, httpResponse);
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(authentication);
        SecurityContextHolder.setContext(context);
        securityContextRepository.saveContext(context, httpRequest, httpResponse);
        return ResponseEntity.ok(MeResponse.of((AccountPrincipal) authentication.getPrincipal()));
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(HttpServletRequest request, HttpServletResponse response, Authentication authentication) {
        logoutHandler.logout(request, response, authentication);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/me")
    MeResponse me(@AuthenticationPrincipal AccountPrincipal principal) {
        return MeResponse.of(principal);
    }
}
