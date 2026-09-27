package com.bitcomputer.employee_portal.employee;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.account.AccountRepository;
import com.bitcomputer.employee_portal.account.TemporaryPasswordGenerator;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckProperties;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.AccessBlockRequest;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.CreateRequest;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Created;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Detail;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.Summary;
import com.bitcomputer.employee_portal.employee.AdminEmployeeDto.UpdateRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.session.FindByIndexNameSessionRepository;
import org.springframework.session.Session;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
@Transactional
public class AdminEmployeeService {

    private final EmployeeRepository employeeRepository;
    private final AccountRepository accountRepository;
    private final PasswordEncoder passwordEncoder;
    private final TemporaryPasswordGenerator temporaryPasswordGenerator;
    private final FindByIndexNameSessionRepository<? extends Session> sessionRepository;
    private final EmployeeChangeRecorder changeRecorder;
    private final BackgroundCheckProperties backgroundCheckProperties;
    private final Clock clock;

    /** 직원별 최신 신원조회 상태까지 쿼리 한 번으로 가져온다(EmployeeRepository.findAllWithLatestCheck). */
    @Transactional(readOnly = true)
    public List<Summary> list() {
        LocalDate today = today();
        LocalDate retentionCutoff = today.minus(backgroundCheckProperties.retentionAfterBlock());
        return employeeRepository.findAllWithLatestCheck(retentionCutoff).stream()
                .map(row -> Summary.of(row, today))
                .toList();
    }

    @Transactional(readOnly = true)
    public Detail get(String employeeNo) {
        return detail(find(employeeNo));
    }

    /** 직원 등록과 계정 생성(F3). 사번은 시퀀스로 발급하고, 임시 비밀번호는 서버가 만든다. */
    public Created create(CreateRequest request) {
        validateBirthDate(request.birthDate());
        Employee employee = Employee.register(employeeRepository.nextEmployeeNo(),
                request.lastName(), request.firstName(), request.birthDate(), clock.instant());
        employee.updateContact(new Employee.Contact(
                request.phone(), request.email(), request.address(), request.emergencyContact()), clock.instant());
        employeeRepository.save(employee);

        String temporaryPassword = temporaryPasswordGenerator.generate();
        Account account = accountRepository.save(Account.employee(employee, passwordEncoder.encode(temporaryPassword)));
        log.info("직원 등록: {}", employee.getEmployeeNo());
        return new Created(detail(employee, account.getLoginId()), account.getLoginId(), temporaryPassword);
    }

    public Detail update(String employeeNo, UpdateRequest request, String actorLoginId) {
        validateBirthDate(request.birthDate());
        Employee employee = find(employeeNo);
        Instant now = clock.instant();
        Set<String> changed = employee.updateByAdmin(
                request.lastName(), request.firstName(), request.birthDate(), request.contact(), now);
        changeRecorder.record(employee, actorLoginId, changed, now);
        return detail(employee);
    }

    /**
     * 퇴사 처리. 차단일이 오늘(KST) 이하면 그 직원의 세션 행을 바로 지운다.
     * 미래 날짜(예약)는 지우지 않는다. 그날이 되면 AccessBlockFilter 가 다음 요청에서 막고 세션을 지운다.
     */
    public Detail blockAccess(String employeeNo, AccessBlockRequest request, String actorLoginId) {
        LocalDate today = today();
        LocalDate blockedOn = request == null || request.blockedOn() == null ? today : request.blockedOn();
        Employee employee = find(employeeNo);
        Instant now = clock.instant();
        changeRecorder.record(employee, actorLoginId, employee.blockAccessFrom(blockedOn, now), now);

        if (employee.isAccessBlockedOn(today)) {
            accountRepository.findByEmployeeId(employee.getId())
                    .ifPresent(account -> deleteSessions(account.getLoginId()));
        }
        log.info("퇴사 처리: {} (차단일 {})", employeeNo, blockedOn);
        return detail(employee);
    }

    /** 차단 취소(오입력 정정). 이미 파기된 BG 결과는 돌아오지 않는다. */
    public Detail cancelAccessBlock(String employeeNo, String actorLoginId) {
        Employee employee = find(employeeNo);
        Instant now = clock.instant();
        changeRecorder.record(employee, actorLoginId, employee.cancelAccessBlock(now), now);
        log.info("차단 취소: {}", employeeNo);
        return detail(employee);
    }

    private void deleteSessions(String loginId) {
        sessionRepository.findByPrincipalName(loginId).keySet().forEach(sessionRepository::deleteById);
    }

    private Employee find(String employeeNo) {
        return employeeRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
    }

    private Detail detail(Employee employee) {
        String loginId = accountRepository.findByEmployeeId(employee.getId()).map(Account::getLoginId).orElse(null);
        return detail(employee, loginId);
    }

    private Detail detail(Employee employee, String loginId) {
        return Detail.of(employee, loginId, today());
    }

    private void validateBirthDate(LocalDate birthDate) {
        if (birthDate != null && birthDate.isAfter(today())) {
            throw new ApiException(ErrorCode.BIRTH_DATE_IN_FUTURE);
        }
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
