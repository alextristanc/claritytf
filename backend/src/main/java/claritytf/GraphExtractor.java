package claritytf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

public class GraphExtractor {

    public Model.GraphModel extract(JsonNode root) {
        List<String> warnings = new ArrayList<>();
        List<Model.Node> nodes = extractNodes(root, warnings);
        return new Model.GraphModel(1, nodes, List.of(), extractModules(nodes), warnings);
    }

    private List<Model.Node> extractNodes(JsonNode root, List<String> warnings) {
        List<Model.Node> nodes = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        for (JsonNode rc : root.path("resource_changes")) {
            if ("data".equals(rc.path("mode").asText())) continue;
            String address = rc.path("address").asText("");
            if (address.isEmpty()) { warnings.add("Recurso sin address omitido"); continue; }
            if (!seen.add(address)) { warnings.add("Dirección duplicada omitida: " + address); continue; }

            JsonNode change = rc.path("change");
            String action = toAction(change.path("actions"));
            if (action == null) { warnings.add("Acción no soportada en " + address); continue; }

            JsonNode values = "delete".equals(action) ? change.path("before") : change.path("after");
            nodes.add(new Model.Node(
                address,
                rc.path("type").asText(""),
                rc.path("name").asText(""),
                rc.path("module_address").asText(null),
                action,
                values.isMissingNode() ? null : values));
        }
        return nodes;
    }

    private String toAction(JsonNode actions) {
        List<String> a = new ArrayList<>();
        actions.forEach(x -> a.add(x.asText()));
        if (a.size() == 2 && a.contains("create") && a.contains("delete")) return "replace";
        if (a.size() != 1) return null;
        return switch (a.get(0)) {
            case "create", "update", "delete", "no-op" -> a.get(0);
            default -> null;
        };
    }

    // Módulos y sus padres, derivados de module_address (module.a.module.b → padre module.a)
    private List<Model.ModuleRef> extractModules(List<Model.Node> nodes) {
        Set<String> ids = new LinkedHashSet<>();
        for (var n : nodes) {
            String m = n.module();
            while (m != null) {
                ids.add(m);
                int i = m.lastIndexOf(".module.");
                m = i < 0 ? null : m.substring(0, i);
            }
        }
        List<Model.ModuleRef> out = new ArrayList<>();
        for (String id : ids) {
            int i = id.lastIndexOf(".module.");
            out.add(new Model.ModuleRef(id, i < 0 ? null : id.substring(0, i)));
        }
        return out;
    }
}