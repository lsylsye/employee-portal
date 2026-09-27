package com.bitcomputer.employee_portal.backgroundcheck;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/** 외부 API 대신 정해 둔 응답을 돌려주는 가짜 클라이언트. 실제 호출은 하지 않는다. */
class FakeBackgroundCheckClient extends BackgroundCheckClient {

    final List<CreateRequest> posts = new ArrayList<>();
    final List<String> gets = new ArrayList<>();
    final Deque<CreateOutcome> createOutcomes = new ArrayDeque<>();
    final Deque<FetchOutcome> fetchOutcomes = new ArrayDeque<>();

    FakeBackgroundCheckClient() {
        super(null, null);
    }

    void reset() {
        posts.clear();
        gets.clear();
        createOutcomes.clear();
        fetchOutcomes.clear();
    }

    @Override
    public CreateOutcome create(CreateRequest request) {
        posts.add(request);
        return createOutcomes.isEmpty() ? new CreateOutcome.Created("CHK-" + posts.size() + "-" + System.nanoTime())
                : createOutcomes.poll();
    }

    @Override
    public FetchOutcome fetch(String checkId) {
        gets.add(checkId);
        return fetchOutcomes.isEmpty() ? new FetchOutcome.TemporaryFailure("GET_500") : fetchOutcomes.poll();
    }
}
