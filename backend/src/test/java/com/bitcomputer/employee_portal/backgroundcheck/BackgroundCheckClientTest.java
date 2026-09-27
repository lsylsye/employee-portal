package com.bitcomputer.employee_portal.backgroundcheck;

import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.CreateOutcome;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.CreateRequest;
import com.bitcomputer.employee_portal.backgroundcheck.BackgroundCheckClient.FetchOutcome;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.io.IOException;
import java.net.SocketTimeoutException;
import java.time.Instant;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

/**
 * 외부 BG API 클라이언트 단위 테스트. 실제 API 는 부르지 않는다(stub 서버, 측정 오염 방지).
 * 응답을 세 갈래로 나누는지 본다: 성공 / 확실한 거절(4xx) / 알 수 없음(5xx·타임아웃).
 */
class BackgroundCheckClientTest {

    static final String BASE = "http://bg.stub";

    MockRestServiceServer server;
    BackgroundCheckClient client;

    @BeforeEach
    void setUp() {
        RestClient.Builder builder = RestClient.builder().baseUrl(BASE).defaultHeader("X-Candidate-Key", "stub-key");
        server = MockRestServiceServer.bindTo(builder).build();
        client = new BackgroundCheckClient(builder.build());
    }

    static CreateRequest request() {
        // 남궁서준: 성 = 남궁 → lastName, 이름 = 서준 → firstName
        return new CreateRequest("EMP-003", "서준", "남궁", LocalDate.of(1988, 7, 21));
    }

    @Test
    void POST_성공이면_checkId를_받고_성은_lastName으로_보낸다() {
        server.expect(requestTo(BASE + "/background-checks"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("X-Candidate-Key", "stub-key"))
                .andExpect(jsonPath("$.employeeId").value("EMP-003"))
                .andExpect(jsonPath("$.lastName").value("남궁"))
                .andExpect(jsonPath("$.firstName").value("서준"))
                .andExpect(jsonPath("$.dateOfBirth").value("1988-07-21"))
                .andRespond(withStatus(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON)
                        .body("{\"checkId\":\"CHK-1\",\"status\":\"pending\",\"estimatedCompletionSeconds\":20}"));

        assertThat(client.create(request())).isEqualTo(new CreateOutcome.Created("CHK-1"));
        server.verify();
    }

    @Test
    void POST_4xx는_확실한_거절이다() {
        server.expect(requestTo(BASE + "/background-checks")).andRespond(withStatus(HttpStatus.BAD_REQUEST));

        assertThat(client.create(request())).isEqualTo(new CreateOutcome.Rejected(400));
    }

    @Test
    void POST_5xx는_생성_여부를_알_수_없다() {
        server.expect(requestTo(BASE + "/background-checks")).andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));

        assertThat(client.create(request())).isEqualTo(new CreateOutcome.Unknown("POST_503"));
    }

    @Test
    void POST_타임아웃도_생성_여부를_알_수_없고_재시도하지_않는다() {
        server.expect(requestTo(BASE + "/background-checks")).andRespond(withException(new SocketTimeoutException()));

        assertThat(client.create(request())).isEqualTo(new CreateOutcome.Unknown("POST_IO_ERROR"));
        server.verify(); // 요청은 정확히 한 번
    }

    @Test
    void GET_최종_결과를_받고_creditScore는_버린다() {
        server.expect(requestTo(BASE + "/background-checks/CHK-1"))
                .andExpect(method(HttpMethod.GET))
                .andRespond(withSuccess("""
                        {"checkId":"CHK-1","status":"flagged","criminalRecord":true,"educationVerified":true,
                         "employmentVerified":false,"creditScore":"poor","completedAt":"2026-10-01T01:02:03Z"}
                        """, MediaType.APPLICATION_JSON));

        FetchOutcome outcome = client.fetch("CHK-1");

        assertThat(outcome).isEqualTo(new FetchOutcome.Fetched(new BackgroundCheckClient.Result(
                "flagged", true, true, false, Instant.parse("2026-10-01T01:02:03Z"))));
    }

    @Test
    void GET_진행_중이면_pending이다() {
        server.expect(requestTo(BASE + "/background-checks/CHK-1"))
                .andRespond(withSuccess("{\"checkId\":\"CHK-1\",\"status\":\"pending\",\"completedAt\":null}",
                        MediaType.APPLICATION_JSON));

        FetchOutcome outcome = client.fetch("CHK-1");

        assertThat(((FetchOutcome.Fetched) outcome).result().isPending()).isTrue();
    }

    @Test
    void GET_404는_결과를_받을_수_없음이고_5xx와_IO_오류는_일시적_실패다() {
        server.expect(requestTo(BASE + "/background-checks/CHK-404")).andRespond(withStatus(HttpStatus.NOT_FOUND));
        server.expect(requestTo(BASE + "/background-checks/CHK-500")).andRespond(withStatus(HttpStatus.INTERNAL_SERVER_ERROR));
        server.expect(requestTo(BASE + "/background-checks/CHK-IO")).andRespond(withException(new IOException("reset")));

        assertThat(client.fetch("CHK-404")).isEqualTo(new FetchOutcome.NotAvailable(404));
        assertThat(client.fetch("CHK-500")).isEqualTo(new FetchOutcome.TemporaryFailure("GET_500"));
        assertThat(client.fetch("CHK-IO")).isEqualTo(new FetchOutcome.TemporaryFailure("GET_IO_ERROR"));
    }
}
