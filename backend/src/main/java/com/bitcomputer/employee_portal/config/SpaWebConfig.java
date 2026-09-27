package com.bitcomputer.employee_portal.config;

import java.io.IOException;

import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * React(SPA) 정적 파일 서빙 + 화면 경로 새로고침 처리.
 *
 * 폴백 규칙:
 * 1. 실제 파일이 있으면 그 파일
 * 2. api/ 로 시작하면 폴백하지 않음 → 404
 * 3. 마지막 경로 조각에 확장자(.)가 있으면 폴백하지 않음 → 404
 *    (재배포 후 옛 해시 JS 요청이 index.html 로 200 응답되어 MIME 오류로 가려지는 것을 막기 위함)
 * 4. 그 외(/admin, /me ...)는 index.html → React Router 가 처리
 *
 * 제약: 화면 경로의 마지막 조각에 '.' 이 들어가면 404 가 된다. (이 앱의 경로는 사번·id 만 사용)
 * Spring 7 의 PathPattern 은 "/**" 뒤에 패턴을 둘 수 없어 컨트롤러 forward 대신 리졸버로 처리한다.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry.addResourceHandler("/**")
                .addResourceLocations("classpath:/static/")
                .resourceChain(true)
                .addResolver(new SpaFallbackResolver());
    }

    static class SpaFallbackResolver extends PathResourceResolver {

        @Override
        protected Resource getResource(String resourcePath, Resource location) throws IOException {
            Resource requested = location.createRelative(resourcePath);
            if (requested.exists() && requested.isReadable()) {
                return requested;
            }
            if (resourcePath.startsWith("api/") || hasExtension(resourcePath)) {
                return null;
            }
            Resource index = location.createRelative("index.html");
            return index.exists() ? index : null;
        }

        private boolean hasExtension(String path) {
            String last = path.substring(path.lastIndexOf('/') + 1);
            return last.contains(".");
        }
    }
}
