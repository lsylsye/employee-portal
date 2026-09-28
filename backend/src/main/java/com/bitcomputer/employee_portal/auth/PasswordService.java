package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.account.AccountRepository;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;

/**
 * 본인 비밀번호 변경. 사람이 비밀번호를 정하는 경로가 생겨서 새 비밀번호를 검사한다:
 * 8자 이상, UTF-8 72바이트 이하(BCrypt 는 72바이트 뒤를 버린다), 현재 비밀번호와 달라야 한다.
 */
@Service
@RequiredArgsConstructor
public class PasswordService {

    private final AccountRepository accounts;
    private final PasswordEncoder encoder;
    private final JdbcTemplate jdbc;

    @Transactional
    public void change(String loginId, String currentPassword, String newPassword) {
        // 같은 계정의 동시 변경을 직렬화한다.
        Account account = accounts.findForPasswordChange(loginId)
                .orElseThrow(() -> new ApiException(ErrorCode.UNAUTHENTICATED));
        if (!encoder.matches(currentPassword, account.getPasswordHash())) {
            throw new ApiException(ErrorCode.CURRENT_PASSWORD_INCORRECT);
        }
        if (newPassword.length() < 8 || newPassword.isBlank()
                || newPassword.getBytes(StandardCharsets.UTF_8).length > 72
                || encoder.matches(newPassword, account.getPasswordHash())) {
            throw new ApiException(ErrorCode.INVALID_NEW_PASSWORD);
        }
        account.changePassword(encoder.encode(newPassword));
        // 비밀번호 변경과 모든 세션 삭제를 같은 DB 트랜잭션으로 처리한다(다른 기기의 세션도 끊긴다).
        jdbc.update("DELETE FROM spring_session WHERE principal_name = ?", loginId);
    }
}
