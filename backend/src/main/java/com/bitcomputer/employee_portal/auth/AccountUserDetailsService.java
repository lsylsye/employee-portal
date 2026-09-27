package com.bitcomputer.employee_portal.auth;

import com.bitcomputer.employee_portal.account.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.LocalDate;

@Service
@RequiredArgsConstructor
public class AccountUserDetailsService implements UserDetailsService {

    private final AccountRepository accountRepository;
    private final Clock clock;

    @Override
    public UserDetails loadUserByUsername(String loginId) {
        return accountRepository.findWithEmployeeByLoginId(loginId)
                .map(account -> new AccountPrincipal(account, account.isAccessAllowedOn(LocalDate.now(clock))))
                .orElseThrow(() -> new UsernameNotFoundException("not found"));
    }
}
