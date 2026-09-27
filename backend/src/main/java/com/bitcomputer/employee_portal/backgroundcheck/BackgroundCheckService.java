package com.bitcomputer.employee_portal.backgroundcheck;

import com.bitcomputer.employee_portal.account.Account;
import com.bitcomputer.employee_portal.account.AccountRepository;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.CreateOutcome;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.CreateRequest;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.FetchOutcome;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.Detail;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.HistoryItem;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckDto.MyItem;
import com.bitcomputer.employee_portal.common.ApiException;
import com.bitcomputer.employee_portal.common.ErrorCode;
import com.bitcomputer.employee_portal.employee.Employee;
import com.bitcomputer.employee_portal.employee.EmployeeRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * 신원조회 흐름(DECISIONS (2)). 외부 호출은 트랜잭션 밖에서 한다(느리고 실패가 잦은 호출이 DB 연결을 붙잡지 않게).
 * 그래서 @Transactional 대신 단계마다 짧은 트랜잭션을 연다.
 */
@Slf4j
@Service
public class BackgroundCheckService {

    private final BackgroundCheckRepository checkRepository;
    private final EmployeeRepository employeeRepository;
    private final AccountRepository accountRepository;
    private final BackgroundCheckClient client;
    private final BackgroundCheckProperties properties;
    private final TransactionTemplate tx;
    private final Clock clock;

    public BackgroundCheckService(BackgroundCheckRepository checkRepository, EmployeeRepository employeeRepository,
                                  AccountRepository accountRepository, BackgroundCheckClient client,
                                  BackgroundCheckProperties properties, PlatformTransactionManager transactionManager,
                                  Clock clock) {
        this.checkRepository = checkRepository;
        this.employeeRepository = employeeRepository;
        this.accountRepository = accountRepository;
        this.client = client;
        this.properties = properties;
        this.tx = new TransactionTemplate(transactionManager);
        this.clock = clock;
    }

    private record Started(Long checkRowId, CreateRequest request) {
    }

    /**
     * 실행. 1) PENDING 행을 먼저 만든다(직원당 PENDING 하나 → 두 번째 클릭은 409, 외부 POST 는 한 번만)
     * 2) 트랜잭션 밖에서 POST 3) 결과를 반영한다. 최종 결과는 폴링이 채운다.
     */
    public HistoryItem request(String employeeNo, String actorLoginId) {
        Started started;
        try {
            started = tx.execute(status -> start(employeeNo, actorLoginId));
        } catch (DataIntegrityViolationException e) {
            throw new ApiException(ErrorCode.BACKGROUND_CHECK_IN_PROGRESS);
        }

        CreateOutcome outcome = client.create(started.request());

        return tx.execute(status -> {
            BackgroundCheck check = checkRepository.findById(started.checkRowId()).orElseThrow();
            // Java 17: switch 타입 패턴은 정식 기능이 아니라 instanceof 로 나눈다
            if (outcome instanceof CreateOutcome.Created created) {
                check.attachCheckId(created.checkId());
            } else if (outcome instanceof CreateOutcome.Rejected rejected) {
                check.markFailed("POST_" + rejected.status());
            } else if (outcome instanceof CreateOutcome.Unknown unknown) {
                check.markUnresolved(unknown.reason());
            }
            log.info("신원조회 실행: {} → {}", employeeNo, check.getStatus());
            return HistoryItem.of(check);
        });
    }

    private Started start(String employeeNo, String actorLoginId) {
        Employee employee = employeeRepository.findByEmployeeNo(employeeNo)
                .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
        if (employee.isAccessBlockedOn(today())) {
            throw new ApiException(ErrorCode.EMPLOYEE_ACCESS_BLOCKED);
        }
        if (employee.getBirthDate() == null) {
            throw new ApiException(ErrorCode.BIRTH_DATE_REQUIRED);
        }
        Account actor = accountRepository.findByLoginId(actorLoginId).orElseThrow();
        BackgroundCheck check = checkRepository.saveAndFlush(BackgroundCheck.pending(employee, actor, clock.instant()));
        // lastName = 성, firstName = 이름. 문자열 분리가 아니라 저장된 성·이름을 쓴다(복성).
        return new Started(check.getId(), new CreateRequest(
                employee.getEmployeeNo(), employee.getFirstName(), employee.getLastName(), employee.getBirthDate()));
    }

    /**
     * 폴링 한 바퀴(BackgroundCheckPoller 가 interval 마다 부른다). Retry-After 는 따르지 않는다(MEASUREMENTS §7-5).
     * - check_id 없이 orphanPendingAfter 보다 오래된 PENDING → UNRESOLVED(행 생성 직후 서버가 죽은 경우 복구)
     * - 요청 후 maxWait 가 지난 PENDING → UNRESOLVED(폴링 한도)
     * - 폴링할 때가 된 PENDING → GET. 최종이면 결과 저장, 아니면 다음 바퀴(요청 단위 재시도는 없다)
     */
    public void pollOnce() {
        Instant now = clock.instant();
        List<BackgroundCheck> pending = checkRepository.findByStatusOrderByRequestedAt(BackgroundCheckStatus.PENDING);
        for (BackgroundCheck check : pending) {
            if (check.getCheckId() == null) {
                if (!now.isBefore(check.getRequestedAt().plus(properties.polling().orphanPendingAfter()))) {
                    update(check.getId(), c -> c.markUnresolved("ORPHANED_PENDING"));
                }
                continue;
            }
            if (!now.isBefore(check.getRequestedAt().plus(properties.polling().maxWait()))) {
                update(check.getId(), c -> c.markUnresolved("POLL_TIMEOUT"));
                continue;
            }
            if (!check.isPollDue(now, properties.polling().firstDelay(), properties.polling().interval())) {
                continue;
            }
            FetchOutcome outcome = client.fetch(check.getCheckId());
            update(check.getId(), c -> apply(c, outcome, clock.instant()));
        }
    }

    private void apply(BackgroundCheck check, FetchOutcome outcome, Instant now) {
        if (outcome instanceof FetchOutcome.Fetched fetched) {
            BackgroundCheckClient.Result result = fetched.result();
            BackgroundCheckStatus finalStatus = toFinalStatus(result.status());
            if (finalStatus == null) {
                check.recordPoll(now);
            } else {
                check.complete(finalStatus, result.criminalRecord(), result.educationVerified(),
                        result.employmentVerified(), result.completedAt(), now);
            }
        } else if (outcome instanceof FetchOutcome.NotAvailable notAvailable) {
            check.markUnresolved("GET_" + notAvailable.status());
        } else {
            check.recordPoll(now); // 일시적 실패: 다음 바퀴가 곧 재시도다
        }
    }

    private static BackgroundCheckStatus toFinalStatus(String externalStatus) {
        return switch (externalStatus.toLowerCase(Locale.ROOT)) {
            case "clear" -> BackgroundCheckStatus.CLEAR;
            case "flagged" -> BackgroundCheckStatus.FLAGGED;
            default -> null;
        };
    }

    /** 폴링 사이에 상태가 바뀌었을 수 있으니 다시 읽어서 아직 PENDING 일 때만 바꾼다. */
    private void update(Long id, java.util.function.Consumer<BackgroundCheck> change) {
        tx.executeWithoutResult(status -> checkRepository.findById(id)
                .filter(BackgroundCheck::isPending)
                .ifPresent(change));
    }

    /** 관리자: 직원별 이력(판정만). 보관 기간이 지났으면 보여 주지 않는다. */
    public List<HistoryItem> history(String employeeNo) {
        return tx.execute(status -> {
            Employee employee = employeeRepository.findByEmployeeNo(employeeNo)
                    .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
            if (employee.isBackgroundCheckRetentionExpired(today(), properties.retentionAfterBlock())) {
                return List.of();
            }
            return checkRepository.findByEmployeeIdOrderByRequestedAtDesc(employee.getId()).stream()
                    .map(HistoryItem::of).toList();
        });
    }

    /** 관리자: 상세 결과. 저장된 결과만 보여 준다(외부 API 를 부르지 않는다). 보관 기간이 지났으면 없는 것으로 본다. */
    public Detail detail(Long id) {
        return tx.execute(status -> {
            BackgroundCheck check = checkRepository.findWithEmployeeById(id)
                    .orElseThrow(() -> new ApiException(ErrorCode.BACKGROUND_CHECK_NOT_FOUND));
            if (check.getEmployee().isBackgroundCheckRetentionExpired(today(), properties.retentionAfterBlock())) {
                throw new ApiException(ErrorCode.BACKGROUND_CHECK_NOT_FOUND);
            }
            return Detail.of(check);
        });
    }

    /** 직원 본인: 조회 일자와 진행 상태만. */
    public List<MyItem> mine(String employeeNo) {
        return tx.execute(status -> {
            Employee employee = employeeRepository.findByEmployeeNo(employeeNo)
                    .orElseThrow(() -> new ApiException(ErrorCode.EMPLOYEE_NOT_FOUND));
            return checkRepository.findByEmployeeIdOrderByRequestedAtDesc(employee.getId()).stream()
                    .map(MyItem::of).toList();
        });
    }

    private LocalDate today() {
        return LocalDate.now(clock);
    }
}
