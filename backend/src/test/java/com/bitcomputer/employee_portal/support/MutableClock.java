package com.bitcomputer.employee_portal.support;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

/** 테스트에서 시각을 옮기기 위한 Clock. 시간대는 운영과 같은 Asia/Seoul. */
public class MutableClock extends Clock {

    private final ZoneId zone;
    private volatile Instant instant;

    public MutableClock(Instant instant, ZoneId zone) {
        this.instant = instant;
        this.zone = zone;
    }

    public void set(Instant instant) {
        this.instant = instant;
    }

    @Override
    public ZoneId getZone() {
        return zone;
    }

    @Override
    public Clock withZone(ZoneId zone) {
        return new MutableClock(instant, zone);
    }

    @Override
    public Instant instant() {
        return instant;
    }
}
