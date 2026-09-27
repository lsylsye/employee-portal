package com.bitcomputer.employee_portal.common;

import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class ApiExceptionHandler {

    @ExceptionHandler({MethodArgumentNotValidException.class, HttpMessageNotReadableException.class})
    ResponseEntity<ApiError> invalidRequest() {
        return respond(ErrorCode.INVALID_REQUEST);
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> apiException(ApiException e) {
        return respond(e.getErrorCode());
    }

    public static ResponseEntity<ApiError> respond(ErrorCode code) {
        return ResponseEntity.status(code.getStatus()).body(code.toBody());
    }
}
