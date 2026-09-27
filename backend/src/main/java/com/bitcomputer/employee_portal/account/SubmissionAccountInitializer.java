package com.bitcomputer.employee_portal.account;

import com.bitcomputer.employee_portal.employee.Employee;
import com.bitcomputer.employee_portal.employee.EmployeeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * 제출용 계정(관리자 1, 직원 1)을 기동 시 환경변수로 만든다.
 * - 레포가 public 이라 Flyway 시드에 비밀번호 해시를 넣지 않는다.
 * - 값이 없으면 만들지 않고 경고만 남긴다. 계정은 한 번 생기면 이 값이 더 필요 없고,
 *   빠지면 "로그인이 안 된다"로 바로 드러난다(DB 접속 정보처럼 조용히 잘못 동작하지 않는다).
 * - 이미 있는 계정은 건드리지 않는다. 환경변수를 바꿔도 기존 비밀번호는 바뀌지 않는다.
 */
@Slf4j
@Component
public class SubmissionAccountInitializer implements ApplicationRunner {

    static final String ADMIN_LOGIN_ID = "admin";

    private final AccountRepository accountRepository;
    private final EmployeeRepository employeeRepository;
    private final PasswordEncoder passwordEncoder;
    private final String adminPassword;
    private final String employeeNo;
    private final String employeePassword;

    public SubmissionAccountInitializer(AccountRepository accountRepository,
                                        EmployeeRepository employeeRepository,
                                        PasswordEncoder passwordEncoder,
                                        // 빈 값 = "설정 안 함". 기본 비밀번호를 두는 것이 아니다.
                                        @Value("${ADMIN_PASSWORD:}") String adminPassword,
                                        @Value("${SUBMISSION_EMPLOYEE_NO:}") String employeeNo,
                                        @Value("${SUBMISSION_EMPLOYEE_PASSWORD:}") String employeePassword) {
        this.accountRepository = accountRepository;
        this.employeeRepository = employeeRepository;
        this.passwordEncoder = passwordEncoder;
        this.adminPassword = adminPassword;
        this.employeeNo = employeeNo;
        this.employeePassword = employeePassword;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        createAdmin();
        createEmployee();
    }

    private void createAdmin() {
        if (accountRepository.existsByLoginId(ADMIN_LOGIN_ID)) {
            return;
        }
        if (adminPassword.isBlank()) {
            log.warn("ADMIN_PASSWORD 가 없어 제출용 관리자 계정을 만들지 않았다");
            return;
        }
        accountRepository.save(Account.admin(ADMIN_LOGIN_ID, passwordEncoder.encode(adminPassword)));
        log.info("제출용 관리자 계정 생성: {}", ADMIN_LOGIN_ID);
    }

    private void createEmployee() {
        if (employeeNo.isBlank() || employeePassword.isBlank()) {
            log.warn("SUBMISSION_EMPLOYEE_NO/PASSWORD 가 없어 제출용 직원 계정을 만들지 않았다");
            return;
        }
        if (accountRepository.existsByLoginId(employeeNo)) {
            return;
        }
        // 값이 있는데 틀린 경우는 설정 오류라서 기동을 막는다.
        Employee employee = employeeRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new IllegalStateException("SUBMISSION_EMPLOYEE_NO 에 해당하는 직원이 없다: " + employeeNo));
        accountRepository.save(Account.employee(employee, passwordEncoder.encode(employeePassword)));
        log.info("제출용 직원 계정 생성: {}", employeeNo);
    }
}
