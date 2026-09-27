# 단일 서비스 배포: React 빌드 결과를 Spring Boot static/ 에 넣어 JAR 하나로 실행한다.

# 1) React 빌드
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# 2) Spring Boot JAR 빌드
FROM eclipse-temurin:17-jdk AS backend
WORKDIR /app/backend
# 의존성 레이어 캐시: 소스가 바뀌어도 build 파일이 그대로면 다시 받지 않는다.
COPY backend/gradlew backend/settings.gradle backend/build.gradle ./
COPY backend/gradle ./gradle
RUN ./gradlew dependencies --no-daemon -q > /dev/null
COPY backend/src ./src
COPY --from=frontend /app/frontend/dist ./src/main/resources/static
# 테스트는 DB 가 필요하므로 이미지 빌드에서는 제외하고 로컬에서 돌린다.
RUN ./gradlew bootJar -x test --no-daemon

# 3) 실행
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=backend /app/backend/build/libs/app.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-jar", "app.jar"]
