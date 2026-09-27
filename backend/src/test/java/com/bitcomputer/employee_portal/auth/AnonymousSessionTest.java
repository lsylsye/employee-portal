package com.bitcomputer.employee_portal.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import jakarta.servlet.http.Cookie;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;

/**
 * 로그인하지 않은 요청은 세션(spring_session 행)을 만들지 않아야 한다.
 * 만들면 로그인 없이 요청만 반복해도 세션 행이 쌓여 DB 를 채울 수 있다.
 * 세션이 생기면 응답에 SESSION 쿠키가 실린다.
 *
 * CSRF 는 spring-security-test 의 csrf() 대신 실제 흐름(GET /api/auth/csrf → X-XSRF-TOKEN 헤더)으로 보낸다.
 * csrf() 는 컨텍스트의 CSRF 저장소를 세션 기반 테스트 저장소로 바꿔 끼우고 되돌리지 않아서,
 * 같은 컨텍스트를 쓰는 다음 테스트에서 세션이 생긴다(이 테스트가 그걸로 오판한 적이 있다).
 */
@SpringBootTest
@AutoConfigureMockMvc
class AnonymousSessionTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void 인증이_필요한_API를_익명으로_호출해도_세션이_생기지_않는다() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/me")).andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getCookie("SESSION")).isNull();
    }

    @Test
    void CSRF_토큰_발급은_세션을_만들지_않는다() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/auth/csrf")).andReturn();

        assertThat(result.getResponse().getCookie("XSRF-TOKEN")).isNotNull();
        assertThat(result.getResponse().getCookie("SESSION")).isNull();
    }

    @Test
    void 로그인_실패는_세션을_만들지_않는다() throws Exception {
        Cookie xsrf = mockMvc.perform(get("/api/auth/csrf")).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();

        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"NO-SUCH-ID\",\"password\":\"x\"}"))
                .andReturn();

        assertThat(result.getResponse().getStatus()).isEqualTo(401);
        assertThat(result.getResponse().getCookie("SESSION")).isNull();
    }
}
