package com.bitcomputer.employee_portal.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 신원조회 백그라운드 폴링(BackgroundCheckPoller) */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
