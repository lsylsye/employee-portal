package com.bitcomputer.employee_portal.account;

import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * 새 직원 계정의 임시 비밀번호. 사람이 정하지 않고 서버가 만든다
 * (비밀번호 최소 길이 검사를 두지 않은 근거가 "사람이 정하는 경로가 없다"이기 때문).
 * 16자, 헷갈리는 문자(0 O 1 l I)를 뺀 영숫자. 응답에 한 번만 담고 저장·로그하지 않는다.
 */
@Component
public class TemporaryPasswordGenerator {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final int LENGTH = 16;

    private final SecureRandom random = new SecureRandom();

    public String generate() {
        StringBuilder sb = new StringBuilder(LENGTH);
        for (int i = 0; i < LENGTH; i++) {
            sb.append(ALPHABET.charAt(random.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}
