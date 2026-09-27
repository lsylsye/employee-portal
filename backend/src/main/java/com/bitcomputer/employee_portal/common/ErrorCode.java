package com.bitcomputer.employee_portal.common;

import jakarta.servlet.http.HttpServletResponse;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/** 오류 응답 { code, message } 의 코드. 메시지는 사용자 입력을 담지 않는 고정 문구다. */
@Getter
@RequiredArgsConstructor
public enum ErrorCode {

    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다"),
    /** 로그인 실패는 이유(없는 아이디, 틀린 비밀번호, 차단)와 관계없이 이 하나로 응답한다. */
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다"),
    /** 이미 로그인한 세션이 차단됐을 때. 본인 확인이 끝난 상태라 차단 사실을 알려도 된다. */
    ACCESS_BLOCKED(HttpStatus.UNAUTHORIZED, "접근이 차단된 계정입니다"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다"),
    CSRF_INVALID(HttpStatus.FORBIDDEN, "보안 토큰이 없거나 올바르지 않습니다. 페이지를 새로고침해 주세요");

    private final HttpStatus status;
    private final String message;

    public ApiError toBody() {
        return new ApiError(name(), message);
    }

    /** 필터처럼 컨트롤러 밖에서 응답을 쓸 때. 메시지가 고정 문구라 직접 조립해도 안전하다. */
    public void write(HttpServletResponse response) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.getWriter().write("{\"code\":\"" + name() + "\",\"message\":\"" + message + "\"}");
    }
}
