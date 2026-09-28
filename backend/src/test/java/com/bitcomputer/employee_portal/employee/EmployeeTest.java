package com.bitcomputer.employee_portal.employee;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 직원 도메인 규칙 단위 테스트(Spring·DB 없음).
 * 통합 테스트는 몇 가지 경로만 지나가서, 분기가 많은 규칙은 여기서 빠짐없이 본다.
 */
class EmployeeTest {

    static final Instant T0 = Instant.parse("2026-10-01T00:00:00Z");
    static final Instant T1 = Instant.parse("2026-10-01T01:00:00Z");
    static final LocalDate TODAY = LocalDate.of(2026, 10, 1);

    private static Employee employee() {
        Employee e = Employee.register("EMP-900", "김", "민준", LocalDate.of(1990, 3, 15), T0);
        e.updateContact(new Employee.Contact("010-0000-0000", "a@example.com", "서울", "부모"), T0);
        return e;
    }

    private static Employee.Contact noContactChange() {
        return new Employee.Contact(null, null, null, null);
    }

    // ---- 변경 필드 감지 (변경 기록의 근거) ----

    @Test
    void 바뀐_필드만_돌려준다() {
        Employee e = employee();

        assertThat(e.updateContact(new Employee.Contact("010-1111-1111", "a@example.com", null, null), T1))
                .containsExactly("phone");
        assertThat(e.getPhone()).isEqualTo("010-1111-1111");
    }

    @Test
    void null_은_바꾸지_않고_기록도_하지_않는다() {
        Employee e = employee();

        assertThat(e.updateContact(noContactChange(), T1)).isEmpty();
        assertThat(e.getEmail()).isEqualTo("a@example.com");
    }

    @Test
    void 바뀐_것이_없으면_수정_시각도_그대로다() {
        Employee e = employee();
        Instant before = e.getUpdatedAt();

        e.updateContact(new Employee.Contact("010-0000-0000", null, null, null), T1);

        assertThat(e.getUpdatedAt()).isEqualTo(before);
    }

    @Test
    void 바뀌면_수정_시각을_갱신한다() {
        Employee e = employee();

        e.updateContact(new Employee.Contact(null, "b@example.com", null, null), T1);

        assertThat(e.getUpdatedAt()).isEqualTo(T1);
    }

    // ---- 성명 = 성 + 이름 (DB 제약 employee_name_split_ck 와 같은 규칙) ----

    @Test
    void 등록하면_성명을_성과_이름으로_만든다() {
        assertThat(Employee.register("EMP-901", "남궁", "서준", null, T0).getFullName()).isEqualTo("남궁서준");
    }

    @Test
    void 성만_바꿔도_성명을_다시_만든다() {
        Employee e = Employee.register("EMP-902", "황보", "라온", null, T0);

        assertThat(e.updateByAdmin("황", null, null, noContactChange(), T1)).containsExactly("lastName");
        assertThat(e.getFullName()).isEqualTo("황라온");
    }

    @Test
    void 관리자_수정은_성명_생년월일_연락처의_변경을_함께_돌려준다() {
        Employee e = employee();

        assertThat(e.updateByAdmin("박", "민준", LocalDate.of(1991, 1, 1),
                new Employee.Contact(null, null, "부산", null), T1))
                .containsExactly("lastName", "birthDate", "address");
    }

    // ---- 접근 차단일과 상태 ----

    @Test
    void 상태는_차단일과_오늘로_계산한다() {
        Employee e = employee();
        assertThat(e.statusOn(TODAY)).isEqualTo(EmploymentStatus.ACTIVE);

        e.blockAccessFrom(TODAY.plusDays(1), T1);
        assertThat(e.statusOn(TODAY)).isEqualTo(EmploymentStatus.BLOCK_SCHEDULED);
        assertThat(e.statusOn(TODAY.plusDays(1))).isEqualTo(EmploymentStatus.BLOCKED); // 당일부터 차단

        e.blockAccessFrom(TODAY.minusDays(30), T1); // 소급
        assertThat(e.statusOn(TODAY)).isEqualTo(EmploymentStatus.BLOCKED);
    }

    @Test
    void 같은_차단일로_다시_처리하면_변경이_아니다() {
        Employee e = employee();

        assertThat(e.blockAccessFrom(TODAY, T1)).containsExactly("accessBlockedOn");
        assertThat(e.blockAccessFrom(TODAY, T1)).isEmpty();
    }

    // ---- 계정 복구(퇴사 번복): 퇴사일부터 7일 안에서만, 지나면 영구 퇴사 ----

    static final Period WEEK = Period.ofDays(7);

    @Test
    void 계정_복구는_차단일을_비우고_재직으로_돌린다() {
        Employee e = employee();
        e.blockAccessFrom(TODAY, T1);

        assertThat(e.recover(T1)).containsExactly("accessBlockedOn");
        assertThat(e.getAccessBlockedOn()).isNull();
        assertThat(e.statusOn(TODAY)).isEqualTo(EmploymentStatus.ACTIVE);
    }

    @Test
    void 복구는_퇴사일부터_7일째까지만_되고_8일째부터_영구_퇴사다() {
        Employee e = employee();
        e.blockAccessFrom(TODAY, T1); // 10/1 퇴사

        assertThat(e.canRecover(TODAY, WEEK)).isTrue();                   // 10/1(당일)
        assertThat(e.canRecover(TODAY.plusDays(6), WEEK)).isTrue();       // 10/7(7일째)
        assertThat(e.recoverableUntil(TODAY, WEEK)).isEqualTo(TODAY.plusDays(6));
        assertThat(e.canRecover(TODAY.plusDays(7), WEEK)).isFalse();      // 10/8 → 영구 퇴사
        assertThat(e.recoverableUntil(TODAY.plusDays(7), WEEK)).isNull();
    }

    @Test
    void 재직이나_퇴사_예정은_복구할_것이_없다() {
        Employee e = employee();
        assertThat(e.canRecover(TODAY, WEEK)).isFalse();

        e.blockAccessFrom(TODAY.plusDays(3), T1); // 퇴사 예정
        assertThat(e.canRecover(TODAY, WEEK)).isFalse();
        assertThat(e.recoverableUntil(TODAY, WEEK)).isNull();
    }

    @Test
    void 퇴사일은_효력_전에만_바꿀_수_있다() {
        Employee e = employee();
        assertThat(e.canChangeResignationDate(TODAY)).isTrue();          // 재직

        e.blockAccessFrom(TODAY.plusDays(3), T1);
        assertThat(e.canChangeResignationDate(TODAY)).isTrue();          // 퇴사 예정
        assertThat(e.canChangeResignationDate(TODAY.plusDays(3))).isFalse(); // 퇴사일 당일부터 불가
    }
}
