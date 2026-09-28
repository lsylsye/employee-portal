package com.bitcomputer.employee_portal.employee;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * 인사 레코드. 로그인 수단은 {@link com.bitcomputer.employee_portal.account.Account} 가 따로 가진다.
 * 성·이름은 문자열 규칙으로 나누지 않고 저장된 값을 쓴다(복성 때문). lastName = 성.
 */
@Entity
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Employee {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String employeeNo;
    private String fullName;
    private String lastName;
    private String firstName;

    /** 확인되지 않았으면 null (EMP-007). BG 요청을 만들 수 없다. */
    private LocalDate birthDate;

    private String phone;
    private String email;
    private String address;
    private String emergencyContact;

    /** 접근 차단일(퇴사일). 이 날 00:00 KST 부터 차단한다. null 이면 재직 중. */
    private LocalDate accessBlockedOn;

    @Column(insertable = false, updatable = false)
    private Instant createdAt;

    @Column(insertable = false)
    private Instant updatedAt;

    private Employee(String employeeNo, String lastName, String firstName, LocalDate birthDate, Instant now) {
        this.employeeNo = employeeNo;
        this.lastName = lastName;
        this.firstName = firstName;
        this.fullName = lastName + firstName;
        this.birthDate = birthDate;
        this.updatedAt = now;
    }

    /** 신규 등록. 사번은 시퀀스로 발급받아 넘긴다(EmployeeRepository.nextEmployeeNo). */
    public static Employee register(String employeeNo, String lastName, String firstName, LocalDate birthDate, Instant now) {
        return new Employee(employeeNo, lastName, firstName, birthDate, now);
    }

    /**
     * 관리자 수정(성·이름·생년월일 포함). null 인 값은 바꾸지 않는다.
     * 성명은 성+이름으로 다시 만든다(DB 제약 employee_name_split_ck 와 같은 규칙).
     * @return 실제로 값이 바뀐 필드 이름(변경 기록용)
     */
    public Set<String> updateByAdmin(String lastName, String firstName, LocalDate birthDate, Contact contact, Instant now) {
        Set<String> changed = new LinkedHashSet<>();
        if (lastName != null && !lastName.equals(this.lastName)) {
            this.lastName = lastName;
            changed.add("lastName");
        }
        if (firstName != null && !firstName.equals(this.firstName)) {
            this.firstName = firstName;
            changed.add("firstName");
        }
        this.fullName = this.lastName + this.firstName;
        if (birthDate != null && !birthDate.equals(this.birthDate)) {
            this.birthDate = birthDate;
            changed.add("birthDate");
        }
        changed.addAll(updateContact(contact, now));
        touch(changed, now);
        return changed;
    }

    /**
     * 연락처 등 본인도 수정할 수 있는 인적사항. null 인 값은 바꾸지 않는다.
     * @return 실제로 값이 바뀐 필드 이름(변경 기록용)
     */
    public Set<String> updateContact(Contact contact, Instant now) {
        Set<String> changed = new LinkedHashSet<>();
        if (contact.phone() != null && !contact.phone().equals(this.phone)) {
            this.phone = contact.phone();
            changed.add("phone");
        }
        if (contact.email() != null && !contact.email().equals(this.email)) {
            this.email = contact.email();
            changed.add("email");
        }
        if (contact.address() != null && !contact.address().equals(this.address)) {
            this.address = contact.address();
            changed.add("address");
        }
        if (contact.emergencyContact() != null && !contact.emergencyContact().equals(this.emergencyContact)) {
            this.emergencyContact = contact.emergencyContact();
            changed.add("emergencyContact");
        }
        touch(changed, now);
        return changed;
    }

    /** 퇴사 처리. 오늘·과거면 즉시, 미래면 예약이다(요청마다 비교하므로 스케줄러가 없다). */
    public Set<String> blockAccessFrom(LocalDate blockedOn, Instant now) {
        return changeAccessBlockedOn(blockedOn, now);
    }

    /**
     * 계정 복구(퇴사 번복). 퇴사일부터 복구 기간 안에서만 부른다(canRecover). 재입사는 새 사번으로 등록한다.
     */
    public Set<String> recover(Instant now) {
        return changeAccessBlockedOn(null, now);
    }

    /** 퇴사일 변경은 효력이 생기기 전(퇴사 예정)이나 재직 중에만 된다. 이미 퇴사했으면 복구만 가능하다. */
    public boolean canChangeResignationDate(LocalDate today) {
        return !isAccessBlockedOn(today);
    }

    /** 퇴사 효력이 생긴 뒤, 퇴사일 + 복구 기간 전까지만 복구할 수 있다. */
    public boolean canRecover(LocalDate today, Period recoveryWindow) {
        return isAccessBlockedOn(today) && today.isBefore(accessBlockedOn.plus(recoveryWindow));
    }

    /** 복구할 수 있는 마지막 날(KST). 복구할 수 없는 상태면 null. */
    public LocalDate recoverableUntil(LocalDate today, Period recoveryWindow) {
        return canRecover(today, recoveryWindow) ? accessBlockedOn.plus(recoveryWindow).minusDays(1) : null;
    }

    private Set<String> changeAccessBlockedOn(LocalDate blockedOn, Instant now) {
        if (Objects.equals(blockedOn, this.accessBlockedOn)) {
            return Set.of();
        }
        this.accessBlockedOn = blockedOn;
        this.updatedAt = now;
        return Set.of("accessBlockedOn");
    }

    private void touch(Set<String> changed, Instant now) {
        if (!changed.isEmpty()) {
            this.updatedAt = now;
        }
    }

    /**
     * today 는 KST 기준 날짜여야 한다(Clock 주입). 차단일 당일 00:00 부터 차단이므로 당일도 포함한다.
     */
    public boolean isAccessBlockedOn(LocalDate today) {
        return accessBlockedOn != null && !today.isBefore(accessBlockedOn);
    }

    public EmploymentStatus statusOn(LocalDate today) {
        return EmploymentStatus.of(accessBlockedOn, today);
    }

    /** 접근 차단일 + 보관 기간이 지났으면 신원조회 결과를 보여 주지 않는다(DECISIONS (3), 필터링만). */
    public boolean isBackgroundCheckRetentionExpired(LocalDate today, Period retentionAfterBlock) {
        return accessBlockedOn != null && !accessBlockedOn.isAfter(today.minus(retentionAfterBlock));
    }

    /** 연락처 묶음. 필드별 null 은 "바꾸지 않음"이다. */
    public record Contact(String phone, String email, String address, String emergencyContact) {
    }
}
