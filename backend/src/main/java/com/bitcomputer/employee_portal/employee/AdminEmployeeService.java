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
    private final EmployeeProperties employeeProperties;
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
     * 퇴사 처리와 퇴사일 변경. 차단일이 오늘(KST) 이하면 그 직원의 세션 행을 바로 지운다.
     * 미래 날짜(예약)는 지우지 않는다. 그날이 되면 AccessBlockFilter 가 다음 요청에서 막고 세션을 지운다.
     * 이미 퇴사 효력이 생긴 직원은 퇴사일을 바꿀 수 없다(409). 먼 미래로 옮겨 사실상 취소하는 우회를 막는다.
     */
    public Detail blockAccess(String employeeNo, AccessBlockRequest request, String actorLoginId) {
        LocalDate today = today();
        LocalDate blockedOn = request == null || request.blockedOn() == null ? today : request.blockedOn();
        Employee employee = find(employeeNo);
        if (!employee.canChangeResignationDate(today)) {
            throw new ApiException(ErrorCode.RESIGNATION_ALREADY_EFFECTIVE);
        }
        Instant now = clock.instant();
        changeRecorder.record(employee, actorLoginId, employee.blockAccessFrom(blockedOn, now), now);

        if (employee.isAccessBlockedOn(today)) {
            accountRepository.findByEmployeeId(employee.getId())
                    .ifPresent(account -> deleteSessions(account.getLoginId()));
        }
        log.info("퇴사 처리: {} (차단일 {})", employeeNo, blockedOn);
        return detail(employee);
    }

    /**
     * 계정 복구(퇴사 번복). 퇴사 효력이 생긴 뒤 복구 기간(기본 7일) 안에서만 된다. 지나면 영구 퇴사다.
     * 퇴사 예정(효력 전)은 복구가 아니라 퇴사일 변경으로 조정한다. 세션은 되살리지 않는다(다시 로그인).
     */
    public Detail recoverAccount(String employeeNo, String actorLoginId) {
        LocalDate today = today();
        Employee employee = find(employeeNo);
        if (!employee.isAccessBlockedOn(today)) {
            throw new ApiException(ErrorCode.ACCOUNT_RECOVERY_NOT_AVAILABLE);
        }
        if (!employee.canRecover(today, employeeProperties.recoveryWindow())) {
            throw new ApiException(ErrorCode.ACCOUNT_RECOVERY_EXPIRED);
        }
        Instant now = clock.instant();
        changeRecorder.record(employee, actorLoginId, employee.recover(now), now);
        log.info("계정 복구: {}", employeeNo);
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
        return Detail.of(employee, loginId, today(), employeeProperties.recoveryWindow());
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
