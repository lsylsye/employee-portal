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

    CURRENT_PASSWORD_INCORRECT(HttpStatus.BAD_REQUEST, "현재 비밀번호가 올바르지 않습니다"),
    INVALID_NEW_PASSWORD(HttpStatus.BAD_REQUEST, "새 비밀번호는 8자 이상, UTF-8 기준 72바이트 이하여야 하며 현재 비밀번호와 달라야 합니다"),
    INVALID_REQUEST(HttpStatus.BAD_REQUEST, "요청 형식이 올바르지 않습니다"),
    /** 로그인 실패는 이유(없는 아이디, 틀린 비밀번호, 차단)와 관계없이 이 하나로 응답한다. */
    INVALID_CREDENTIALS(HttpStatus.UNAUTHORIZED, "아이디 또는 비밀번호가 올바르지 않습니다"),
    UNAUTHENTICATED(HttpStatus.UNAUTHORIZED, "로그인이 필요합니다"),
    /** 이미 로그인한 세션이 차단됐을 때. 본인 확인이 끝난 상태라 차단 사실을 알려도 된다. */
    ACCESS_BLOCKED(HttpStatus.UNAUTHORIZED, "접근이 차단된 계정입니다"),
    FORBIDDEN(HttpStatus.FORBIDDEN, "권한이 없습니다"),
    EMPLOYEE_NOT_FOUND(HttpStatus.NOT_FOUND, "직원을 찾을 수 없습니다"),
    /** 퇴사 효력이 생긴 뒤에는 퇴사일을 바꿀 수 없다(복구 기간 안이면 계정 복구만 가능). */
    RESIGNATION_ALREADY_EFFECTIVE(HttpStatus.CONFLICT, "이미 퇴사한 직원은 퇴사일을 바꿀 수 없습니다"),
    /** 재직·퇴사 예정 상태는 복구할 것이 없다(퇴사 예정은 퇴사일 변경으로 조정한다). */
    ACCOUNT_RECOVERY_NOT_AVAILABLE(HttpStatus.CONFLICT, "퇴사 처리된 직원만 계정을 복구할 수 있습니다"),
    ACCOUNT_RECOVERY_EXPIRED(HttpStatus.CONFLICT, "계정 복구 기간이 지나 영구 퇴사 처리되었습니다"),
    BIRTH_DATE_IN_FUTURE(HttpStatus.BAD_REQUEST, "생년월일은 오늘 이후일 수 없습니다"),
    BACKGROUND_CHECK_NOT_FOUND(HttpStatus.NOT_FOUND, "신원조회 결과를 찾을 수 없습니다"),
    BACKGROUND_CHECK_IN_PROGRESS(HttpStatus.CONFLICT, "이미 진행 중인 신원조회가 있습니다"),
    /** 생년월일이 없으면 외부 API 가 400 을 준다(실측 E0). 임의 날짜로 채우지 않는다. */
    BIRTH_DATE_REQUIRED(HttpStatus.UNPROCESSABLE_CONTENT, "생년월일 확인이 필요합니다"),
    EMPLOYEE_ACCESS_BLOCKED(HttpStatus.UNPROCESSABLE_CONTENT, "퇴사 처리된 직원은 신원조회를 할 수 없습니다"),
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
