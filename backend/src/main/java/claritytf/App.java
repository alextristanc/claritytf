package claritytf;

import claritytf.PlanException.Code;
import io.javalin.Javalin;
import io.javalin.http.HttpResponseException;
import java.util.Map;

public class App {
    private static final int DEFAULT_PORT = 8080;

    // Fábrica sin arrancar: main usa el puerto de PORT y los tests arrancan en uno aleatorio.
    public static Javalin create() {
        var parser = new PlanParser();

        var app = Javalin.create(cfg -> {
            cfg.http.maxRequestSize = 5_000_000L;
            cfg.bundledPlugins.enableCors(cors -> cors.addRule(rule -> rule.anyHost()));
        });

        app.get("/health", ctx -> ctx.json(Map.of("status", "ok")));
        app.post("/parse", ctx -> ctx.json(parser.parse(ctx.bodyAsBytes())));

        app.exception(PlanException.class, (e, ctx) ->
            ctx.status(e.code.status).json(Map.of("code", e.code.name(), "message", e.getMessage())));
        app.exception(HttpResponseException.class, (e, ctx) -> {
            Code code = e.getStatus() == Code.FILE_TOO_LARGE.status ? Code.FILE_TOO_LARGE : Code.INTERNAL_ERROR;
            ctx.status(e.getStatus()).json(Map.of("code", code.name(), "message", "Solicitud rechazada"));
        });
        app.exception(Exception.class, (e, ctx) ->
            ctx.status(Code.INTERNAL_ERROR.status).json(Map.of("code", Code.INTERNAL_ERROR.name(), "message", "Error inesperado")));

        return app;
    }

    static int port() {
        String raw = System.getenv("PORT");
        if (raw == null) return DEFAULT_PORT;
        try {
            int port = Integer.parseInt(raw.trim());
            return port >= 1 && port <= 65535 ? port : DEFAULT_PORT;
        } catch (NumberFormatException e) {
            return DEFAULT_PORT;
        }
    }

    public static void main(String[] args) {
        create().start(port());
    }
}
