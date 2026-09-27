package com.bitcomputer.employee_portal.account;

import org.junit.jupiter.api.RepeatedTest;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/** 임시 비밀번호 규칙 단위 테스트(Spring 없음). */
class TemporaryPasswordGeneratorTest {

    final TemporaryPasswordGenerator generator = new TemporaryPasswordGenerator();

    @RepeatedTest(20)
    void 길이는_16자_영숫자이고_헷갈리는_문자가_없다() {
        assertThat(generator.generate())
                .hasSize(16)
                .matches("[A-Za-z2-9]+")
                .doesNotContain("0", "O", "1", "l", "I");
    }

    @Test
    void 매번_다른_값을_만든다() {
        Set<String> generated = new HashSet<>();
        for (int i = 0; i < 1000; i++) {
            generated.add(generator.generate());
        }
        assertThat(generated).hasSize(1000);
    }
}
