FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn -q -DskipTests package

FROM eclipse-temurin:21-jre
WORKDIR /app
RUN useradd --system --uid 10001 --shell /usr/sbin/nologin claritytf
COPY --from=build /app/target/claritytf-backend.jar app.jar
USER claritytf
ENV PORT=8080
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]
