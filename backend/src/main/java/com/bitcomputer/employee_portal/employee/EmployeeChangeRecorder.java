package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.account.AccountRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.Set;

/** 변경된 필드 이름만 기록한다(값은 남기지 않는다). 호출하는 쪽의 트랜잭션 안에서 저장된다. */
@Component
@RequiredArgsConstructor
public class EmployeeChangeRecorder {

    private final EmployeeChangeLogRepository changeLogRepository;
    private final AccountRepository accountRepository;

    /** actorLoginId: 세션 principal 의 loginId(본인 또는 관리자) */
    public void record(Employee employee, String actorLoginId, Set<String> changedFields, Instant now) {
        if (changedFields.isEmpty()) {
            return;
        }
        Account actor = accountRepository.findByLoginId(actorLoginId)
                .orElseThrow(() -> new IllegalStateException("로그인한 계정이 없다"));
        changedFields.forEach(field -> changeLogRepository.save(new EmployeeChangeLog(employee, actor, field, now)));
    }
}
