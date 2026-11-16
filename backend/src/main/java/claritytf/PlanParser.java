package claritytf;

import claritytf.PlanException.Code;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;



public class PlanParser {
    private final GraphExtractor extractor = new GraphExtractor();
    private final ObjectMapper mapper = new ObjectMapper();

    public Model.GraphModel parse(byte[] bytes) {
        if (bytes == null || bytes.length == 0)
            throw new PlanException(Code.NO_FILE, "Cuerpo vacío");

        JsonNode root;
        try { root = mapper.readTree(bytes); }
        catch (IOException e) { throw new PlanException(Code.INVALID_JSON, "JSON mal formado"); }

        if (!root.path("resource_changes").isArray()
                || !root.path("configuration").path("root_module").isObject())
            throw new PlanException(Code.NOT_A_PLAN, "Falta resource_changes o configuration.root_module");
        if (root.path("resource_changes").isEmpty())
            throw new PlanException(Code.EMPTY_PLAN, "Sin recursos");

        // Siguiente paso: GraphExtractor llenará nodos, aristas y módulos
        return extractor.extract(root);
    }
}