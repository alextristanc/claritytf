package claritytf;

import claritytf.PlanException.Code;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;



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

        Model.GraphModel model = extractor.extract(root);
        // Un plan con solo data sources (o sin cambios representables) deja el grafo vacío
        if (model.nodes().isEmpty())
            throw new PlanException(Code.EMPTY_PLAN, "Sin recursos representables");

        // format_version ausente o de una major distinta: advertencia, no bloquea.
        List<String> warnings = new ArrayList<>(model.warnings());
        String formatVersion = root.path("format_version").asText("");
        if (formatVersion.isEmpty())
            warnings.add("El plan no incluye format_version");
        else if (!"1".equals(formatVersion.split("\\.")[0]))
            warnings.add("format_version " + formatVersion + " no soportada (se espera 1.x)");

        if (warnings.size() == model.warnings().size()) return model;
        return new Model.GraphModel(model.schemaVersion(), model.nodes(), model.edges(),
            model.modules(), warnings);
    }
}