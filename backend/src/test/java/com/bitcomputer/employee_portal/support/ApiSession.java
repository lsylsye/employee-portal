package com.bitcomputer.employee_portal.support;

import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * 프론트와 같은 방식으로 API 를 부르는 테스트 도우미: 세션 쿠키 + 실제 CSRF 흐름(GET /api/auth/csrf → X-XSRF-TOKEN).
 * spring-security-test 의 csrf() 는 CSRF 저장소를 세션 기반으로 바꿔 끼워 운영에 없는 익명 세션을 만들어서 쓰지 않는다.
 */
public record ApiSession(MockMvc mockMvc, Cookie session) {

    public static ApiSession login(MockMvc mockMvc, String loginId, String password) throws Exception {
        Cookie session = new ApiSession(mockMvc, null)
                .send(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"loginId\":\"" + loginId + "\",\"password\":\"" + password + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie("SESSION");
        assertThat(session).isNotNull();
        return new ApiSession(mockMvc, session);
    }

    /** GET 은 그대로, 상태를 바꾸는 요청은 CSRF 토큰을 붙여 보낸다. */
    public ResultActions send(MockHttpServletRequestBuilder request) throws Exception {
        if (session != null) {
            request.cookie(session);
        }
        var built = request.buildRequest(new org.springframework.mock.web.MockServletContext());
        if (!"GET".equals(built.getMethod())) {
            Cookie xsrf = xsrf();
            request.cookie(xsrf).header("X-XSRF-TOKEN", xsrf.getValue());
        }
        return mockMvc.perform(request);
    }

    public String sessionId() {
        return new String(Base64.getDecoder().decode(session.getValue()), StandardCharsets.UTF_8);
    }

    private Cookie xsrf() throws Exception {
        var request = get("/api/auth/csrf");
        if (session != null) {
            request.cookie(session);
        }
        Cookie xsrf = mockMvc.perform(request).andReturn().getResponse().getCookie("XSRF-TOKEN");
        assertThat(xsrf).isNotNull();
        return xsrf;
    }
}
