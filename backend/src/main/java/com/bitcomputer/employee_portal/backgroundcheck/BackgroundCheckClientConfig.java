package com.bitcomputer.employee_portal.backgroundcheck;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;

@Configuration
public class BackgroundCheckClientConfig {

    @Bean
    BackgroundCheckClient backgroundCheckClient(BackgroundCheckProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder().connectTimeout(properties.connectTimeout()).build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return new BackgroundCheckClient(RestClient.builder()
                .baseUrl(properties.baseUrl())
                .defaultHeader("X-Candidate-Key", properties.apiKey())
                .requestFactory(requestFactory)
                .build());
    }
}
