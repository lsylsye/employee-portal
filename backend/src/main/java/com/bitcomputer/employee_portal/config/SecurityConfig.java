package com.bitcomputer.employee_portal.config;

import com.bitcomputer.employee_portal.account.AccountRepository;
import com.bitcomputer.employee_portal.auth.AccessBlockFilter;
import com.bitcomputer.employee_portal.auth.AccountPrincipal;
import com.bitcomputer.employee_portal.common.ErrorCode;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.ProviderManager;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.access.intercept.AuthorizationFilter;
import org.springframework.security.web.authentication.logout.CompositeLogoutHandler;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfException;
import org.springframework.security.web.csrf.CsrfLogoutHandler;
import org.springframework.security.web.savedrequest.NullRequestCache;

import java.time.Clock;
import java.util.List;

/**
 * 세션 쿠키 인증(Spring Session JDBC).
 * - 로그인은 JSON API(AuthController). 폼 로그인·HTTP Basic 은 쓰지 않는다.
 * - CSRF: SPA 방식(XSRF-TOKEN 쿠키 → X-XSRF-TOKEN 헤더). 로그인 요청에도 적용한다.
 * - 권한: /api/admin/** 는 ADMIN, 나머지 /api/** 는 로그인 필요. 화면(정적 파일)은 공개.
 * - 이미 로그인한 세션도 요청마다 차단 여부를 다시 본다(AccessBlockFilter).
 * - 익명 요청은 세션을 만들지 않는다. 로그인 없이 요청만 반복해 spring_session 행을 쌓는 것을 막는다.
 */
@Configuration
public class SecurityConfig {

    /** 쿠키 기반이라 상태가 없다. spa() 가 내부에서 만드는 것과 같은 설정이므로 로그인·로그아웃에서 같이 쓴다. */
    private final CookieCsrfTokenRepository csrfTokenRepository = CookieCsrfTokenRepository.withHttpOnlyFalse();

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http, SecurityContextRepository securityContextRepository,
                                            AccountRepository accountRepository, Clock clock) throws Exception {
        http
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/api/auth/csrf", "/api/auth/login").permitAll()
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/**").authenticated()
                        .anyRequest().permitAll())
                .csrf(csrf -> csrf.spa())
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                // 기본 HttpSessionRequestCache 는 미인증 요청을 로그인 후 되돌아가려고 세션에 저장한다.
                // 그 과정에서 익명 요청마다 세션(행)이 생긴다. SPA 라 되돌아갈 요청을 서버가 기억할 필요가 없다.
                .requestCache(cache -> cache.requestCache(new NullRequestCache()))
                .addFilterBefore(new AccessBlockFilter(accountRepository, clock), AuthorizationFilter.class)
                .exceptionHandling(e -> e
                        .authenticationEntryPoint((request, response, ex) -> ErrorCode.UNAUTHENTICATED.write(response))
                        .accessDeniedHandler((request, response, ex) ->
                                (ex instanceof CsrfException ? ErrorCode.CSRF_INVALID : ErrorCode.FORBIDDEN).write(response)));
        return http.build();
    }

    @Bean
    SecurityContextRepository securityContextRepository() {
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(), new HttpSessionSecurityContextRepository());
    }

    /**
     * 차단 검사는 비밀번호 확인 "뒤"(postAuthenticationChecks)에 한다.
     * 기본 동작처럼 앞에서(enabled) 검사하면 차단 계정은 BCrypt 계산을 건너뛰어 응답이 빨라지고,
     * 메시지를 통일해도 응답 시간으로 퇴사 여부가 드러난다.
     */
    @Bean
    AuthenticationManager authenticationManager(UserDetailsService userDetailsService, PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider(userDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        provider.setPostAuthenticationChecks(user -> {
            if (!((AccountPrincipal) user).isAccessAllowed()) {
                throw new DisabledException("blocked");
            }
        });
        return new ProviderManager(provider);
    }

    /** 로그인 성공 시: 세션 ID 교체(세션 고정 공격 방지) + CSRF 토큰 교체 */
    @Bean
    SessionAuthenticationStrategy sessionAuthenticationStrategy() {
        return new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(),
                new CsrfAuthenticationStrategy(csrfTokenRepository)));
    }

    /** 로그아웃: CSRF 토큰 삭제 + 세션 무효화(spring_session 행 삭제) */
    @Bean
    LogoutHandler logoutHandler() {
        return new CompositeLogoutHandler(new CsrfLogoutHandler(csrfTokenRepository), new SecurityContextLogoutHandler());
    }
}
