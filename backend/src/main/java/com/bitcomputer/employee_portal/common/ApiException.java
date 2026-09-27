package com.bitcomputer.employee_portal.common;

import lombok.Getter;

/** 정해진 오류 코드로 응답하는 예외. 메시지는 ErrorCode 의 고정 문구를 쓴다. */
@Getter
public class ApiException extends RuntimeException {

    private final ErrorCode errorCode;

    public ApiException(ErrorCode errorCode) {
        super(errorCode.name());
        this.errorCode = errorCode;
    }
}
