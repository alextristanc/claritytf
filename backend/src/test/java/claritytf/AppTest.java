package claritytf;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

class AppTest {
    private static Javalin app;
    private static HttpClient client;
    private static String baseUrl;
    private static final ObjectMapper mapper = new ObjectMapper();

    @BeforeAll
    static void start() {
        app = App.create().start(0);
        baseUrl = "http://localhost:" + app.port();
        client = HttpClient.newHttpClient();
    }

    @AfterAll
    static void stop() {
        if (app != null) app.stop();
    }

    private static HttpResponse<String> post(byte[] body) throws Exception {
        var req = HttpRequest.newBuilder(URI.create(baseUrl + "/parse"))
            .POST(HttpRequest.BodyPublishers.ofByteArray(body))
            .build();
        return client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private static HttpResponse<String> get(String path) throws Exception {
        return client.send(HttpRequest.newBuilder(URI.create(baseUrl + path)).GET().build(),
            HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
    }

    private static String code(HttpResponse<String> res) throws Exception {
        return mapper.readTree(res.body()).path("code").asText();
    }

    private static byte[] planFixture(String name) throws Exception {
        try (var in = AppTest.class.getResourceAsStream("/fixtures/" + name)) {
            if (in == null) throw new AssertionError("Fixture no encontrado: /fixtures/" + name);
            return in.readAllBytes();
        }
    }

    @Test void healthRespondeOk() throws Exception {
        var res = get("/health");
        assertEquals(200, res.statusCode());
        assertEquals("ok", mapper.readTree(res.body()).path("status").asText());
    }

    @Test void cuerpoVacioDevuelveNoFile() throws Exception {
        var res = post(new byte[0]);
        assertEquals(400, res.statusCode());
        assertEquals("NO_FILE", code(res));
    }

    @Test void cuerpoDemasiadoGrandeDevuelveFileTooLarge() throws Exception {
        var res = post(new byte[5_000_001]);
        assertEquals(413, res.statusCode());
        assertEquals("FILE_TOO_LARGE", code(res));
    }

    @Test void textoNoJsonDevuelveInvalidJson() throws Exception {
        var res = post("hola".getBytes(StandardCharsets.UTF_8));
        assertEquals(400, res.statusCode());
        assertEquals("INVALID_JSON", code(res));
    }

    @Test void jsonSinEstructuraDevuelveNotAPlan() throws Exception {
        var res = post("{}".getBytes(StandardCharsets.UTF_8));
        assertEquals(422, res.statusCode());
        assertEquals("NOT_A_PLAN", code(res));
    }

    @Test void planSinRecursosDevuelveEmptyPlan() throws Exception {
        String body = "{\"resource_changes\":[],\"configuration\":{\"root_module\":{}}}";
        var res = post(body.getBytes(StandardCharsets.UTF_8));
        assertEquals(422, res.statusCode());
        assertEquals("EMPTY_PLAN", code(res));
    }

    @Test void planValidoDevuelveGrafo() throws Exception {
        var res = post(planFixture("plan.json"));
        assertEquals(200, res.statusCode());
        JsonNode json = mapper.readTree(res.body());
        assertEquals(1, json.path("schemaVersion").asInt());
        assertEquals(3, json.path("nodes").size());
        assertEquals(2, json.path("edges").size());
    }
}
