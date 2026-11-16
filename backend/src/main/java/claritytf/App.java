package claritytf;

import io.javalin.Javalin;
import io.javalin.http.HttpResponseException;
import java.util.Map;

public class App {
    public static void main(String[] args) {
        var parser = new PlanParser();

        var app = Javalin.create(cfg -> {
            cfg.http.maxRequestSize = 5_000_000L;
            cfg.bundledPlugins.enableCors(cors -> cors.addRule(rule -> rule.anyHost()));
        });

        app.post("/parse", ctx -> ctx.json(parser.parse(ctx.bodyAsBytes())));

        app.exception(PlanException.class, (e, ctx) ->
            ctx.status(e.code.status).json(Map.of("code", e.code.name(), "message", e.getMessage())));
        app.exception(HttpResponseException.class, (e, ctx) -> {
            String code = e.getStatus() == 413 ? "FILE_TOO_LARGE" : "INTERNAL_ERROR";
            ctx.status(e.getStatus()).json(Map.of("code", code, "message", "Solicitud rechazada"));
        });
        app.exception(Exception.class, (e, ctx) ->
            ctx.status(500).json(Map.of("code", "INTERNAL_ERROR", "message", "Error inesperado")));

        app.start(8080);
    }
}