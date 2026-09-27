package com.bitcomputer.employee_portal.backgroundcheck;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.time.Instant;
import java.time.LocalDate;

/**
 * 외부 Background Check API 클라이언트. 브라우저는 CORS 로 직접 부를 수 없고, 키를 노출하지 않기 위해 서버가 중계한다.
 * - 재시도하지 않는다. POST 는 멱등키가 없어서(S5) 재시도가 중복 생성이 될 수 있고, GET 은 다음 폴링이 곧 재시도다.
 * - 로그에는 checkId·상태코드만 남긴다. 이름·생년월일·결과는 남기지 않는다(N6).
 */
@Slf4j
public class BackgroundCheckClient {

    private final RestClient restClient;

    public BackgroundCheckClient(RestClient restClient) {
        this.restClient = restClient;
    }

    /** POST 요청 본문. lastName = 성, firstName = 이름(명세의 "last" 는 순서가 아니라 family name). */
    public record CreateRequest(String employeeId, String firstName, String lastName, LocalDate dateOfBirth) {
    }

    record CreatedBody(String checkId, String status) {
    }

    record ResultBody(String checkId, String status, Boolean criminalRecord, Boolean educationVerified,
                      Boolean employmentVerified, Instant completedAt) {
    }

    /** 외부 판정. creditScore 는 받아도 버린다(최소 수집). */
    public record Result(String status, Boolean criminalRecord, Boolean educationVerified,
                         Boolean employmentVerified, Instant completedAt) {
        public boolean isPending() {
            return "pending".equals(status);
        }
    }

    public sealed interface CreateOutcome {
        record Created(String checkId) implements CreateOutcome {
        }

        /** 4xx: 외부가 확실히 거절했다. 생성되지 않았다 → FAILED */
        record Rejected(int status) implements CreateOutcome {
        }

        /** 5xx·타임아웃·네트워크 오류: 생성됐는지 알 수 없다 → UNRESOLVED(재시도하지 않는다) */
        record Unknown(String reason) implements CreateOutcome {
        }
    }

    public sealed interface FetchOutcome {
        record Fetched(Result result) implements FetchOutcome {
        }

        /** 4xx(404 등): 이 checkId 로는 결과를 받을 수 없다 → UNRESOLVED */
        record NotAvailable(int status) implements FetchOutcome {
        }

        /** 5xx·타임아웃: 일시적 실패 → 다음 폴링에서 다시 본다 */
        record TemporaryFailure(String reason) implements FetchOutcome {
        }
    }

    public CreateOutcome create(CreateRequest request) {
        try {
            return restClient.post().uri("/background-checks")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .exchange((req, res) -> {
                        HttpStatusCode status = res.getStatusCode();
                        log.info("BG POST {}", status.value());
                        if (status.is2xxSuccessful()) {
                            CreatedBody body = res.bodyTo(CreatedBody.class);
                            if (body == null || body.checkId() == null) {
                                return new CreateOutcome.Unknown("POST_NO_CHECK_ID");
                            }
                            return new CreateOutcome.Created(body.checkId());
                        }
                        if (status.is4xxClientError()) {
                            return new CreateOutcome.Rejected(status.value());
                        }
                        return new CreateOutcome.Unknown("POST_" + status.value());
                    });
        } catch (RestClientException e) {
            log.warn("BG POST 실패: {}", e.getClass().getSimpleName());
            return new CreateOutcome.Unknown("POST_IO_ERROR");
        }
    }

    public FetchOutcome fetch(String checkId) {
        try {
            return restClient.get().uri("/background-checks/{checkId}", checkId)
                    .exchange((req, res) -> {
                        HttpStatusCode status = res.getStatusCode();
                        log.info("BG GET {} {}", checkId, status.value());
                        if (status.is2xxSuccessful()) {
                            ResultBody body = res.bodyTo(ResultBody.class);
                            if (body == null || body.status() == null) {
                                return new FetchOutcome.TemporaryFailure("GET_EMPTY_BODY");
                            }
                            return new FetchOutcome.Fetched(new Result(body.status(), body.criminalRecord(),
                                    body.educationVerified(), body.employmentVerified(), body.completedAt()));
                        }
                        if (status.is4xxClientError()) {
                            return new FetchOutcome.NotAvailable(status.value());
                        }
                        return new FetchOutcome.TemporaryFailure("GET_" + status.value());
                    });
        } catch (RestClientException e) {
            log.warn("BG GET {} 실패: {}", checkId, e.getClass().getSimpleName());
            return new FetchOutcome.TemporaryFailure("GET_IO_ERROR");
        }
    }
}
