package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.account.Role;
import lombok.Getter;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.List;

/**
 * 세션(spring_session)에 직렬화되어 저장되는 로그인 주체. getUsername() = loginId 가 세션의
 * PRINCIPAL_NAME 이 되어, 퇴사 처리 시 이 값으로 세션 행을 찾아 지운다.
 * 비밀번호 해시는 인증 직후 지운다(CredentialsContainer) → 세션에 남지 않는다.
 */
@Getter
public class AccountPrincipal implements UserDetails, CredentialsContainer {

    private final String loginId;
    private final Role role;
    /** 관리자는 null */
    private final String employeeNo;
    private String passwordHash;
    /** 로그인 시점 판단용. 요청마다의 판단은 AccessBlockFilter 가 DB 에서 다시 한다. */
    private final transient boolean accessAllowed;

    AccountPrincipal(Account account, boolean accessAllowed) {
        this.loginId = account.getLoginId();
        this.role = account.getRole();
        this.employeeNo = account.getEmployee() == null ? null : account.getEmployee().getEmployeeNo();
        this.passwordHash = account.getPasswordHash();
        this.accessAllowed = accessAllowed;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return loginId;
    }

    @Override
    public void eraseCredentials() {
        passwordHash = null;
    }
}
