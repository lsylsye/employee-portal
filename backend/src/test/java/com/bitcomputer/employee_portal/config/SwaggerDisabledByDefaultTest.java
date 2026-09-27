package com.bitcomputer.employee_portal.config;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** 기본 설정(=운영)에서는 Swagger 가 꺼져 있어야 한다. 로컬 프로필에서만 켠다. */
@SpringBootTest
@AutoConfigureMockMvc
class SwaggerDisabledByDefaultTest {

    @Autowired
    MockMvc mockMvc;

    @Test
    void 기본_설정에서는_API_문서를_노출하지_않는다() throws Exception {
        // 배포 환경에서는 확장자 없는 경로라 SPA 폴백(index.html, 200)이 응답한다. 상태 코드가 아니라
        // "OpenAPI 문서가 아니다"를 본다. (테스트 환경에는 static/ 이 없어 404 가 된다)
        mockMvc.perform(get("/v3/api-docs")).andExpect(content().string(not(containsString("\"openapi\""))));
    }

    @Test
    void 기본_설정에서는_Swagger_UI를_노출하지_않는다() throws Exception {
        mockMvc.perform(get("/swagger-ui.html")).andExpect(status().isNotFound());
    }
}
