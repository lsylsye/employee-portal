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
     */
    public void updateByAdmin(String lastName, String firstName, LocalDate birthDate, Contact contact, Instant now) {
        if (lastName != null) {
            this.lastName = lastName;
        }
        if (firstName != null) {
            this.firstName = firstName;
        }
        this.fullName = this.lastName + this.firstName;
        if (birthDate != null) {
            this.birthDate = birthDate;
        }
        updateContact(contact, now);
    }

    /** 연락처 등 본인도 수정할 수 있는 인적사항. null 인 값은 바꾸지 않는다. */
    public void updateContact(Contact contact, Instant now) {
        if (contact.phone() != null) {
            this.phone = contact.phone();
        }
        if (contact.email() != null) {
            this.email = contact.email();
        }
        if (contact.address() != null) {
            this.address = contact.address();
        }
        if (contact.emergencyContact() != null) {
            this.emergencyContact = contact.emergencyContact();
        }
        this.updatedAt = now;
    }

    /** 퇴사 처리. 오늘·과거면 즉시, 미래면 예약이다(요청마다 비교하므로 스케줄러가 없다). */
    public void blockAccessFrom(LocalDate blockedOn, Instant now) {
        this.accessBlockedOn = blockedOn;
        this.updatedAt = now;
    }

    /** 차단 취소. 오입력 정정용이다(재입사는 새 사번으로 등록한다). */
    public void cancelAccessBlock(Instant now) {
        this.accessBlockedOn = null;
        this.updatedAt = now;
    }

    /**
     * today 는 KST 기준 날짜여야 한다(Clock 주입). 차단일 당일 00:00 부터 차단이므로 당일도 포함한다.
     */
    public boolean isAccessBlockedOn(LocalDate today) {
        return accessBlockedOn != null && !today.isBefore(accessBlockedOn);
    }

    public EmploymentStatus statusOn(LocalDate today) {
        if (accessBlockedOn == null) {
            return EmploymentStatus.ACTIVE;
        }
        return isAccessBlockedOn(today) ? EmploymentStatus.BLOCKED : EmploymentStatus.BLOCK_SCHEDULED;
    }

    /** 연락처 묶음. 필드별 null 은 "바꾸지 않음"이다. */
    public record Contact(String phone, String email, String address, String emergencyContact) {
    }
}
