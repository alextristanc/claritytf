package claritytf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.*;

public class GraphExtractor {

    public Model.GraphModel extract(JsonNode root) {
        List<String> warnings = new ArrayList<>();
        List<Model.Node> nodes = extractNodes(root, warnings);
        List<Model.Edge> edges = extractEdges(root, nodes);
        return new Model.GraphModel(1, nodes, edges, extractModules(nodes), warnings);
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

        private List<Model.Edge> extractEdges(JsonNode root, List<Model.Node> nodes) {
        Map<String, List<String>> byBase = new HashMap<>();
        for (var n : nodes) byBase.computeIfAbsent(base(n.id()), k -> new ArrayList<>()).add(n.id());

        JsonNode rootModule = root.path("configuration").path("root_module");
        Map<String, Set<String>> outputs = new HashMap<>();
        collectOutputs(rootModule, "", outputs);

        Set<Model.Edge> edges = new LinkedHashSet<>();
        walk(rootModule, "", byBase, outputs, edges);
        return new ArrayList<>(edges);
    }

    private void walk(JsonNode module, String prefix, Map<String, List<String>> byBase,
                    Map<String, Set<String>> outputs, Set<Model.Edge> edges) {
        for (JsonNode res : module.path("resources")) {
            List<String> targets = byBase.getOrDefault(prefix + res.path("address").asText(), List.of());
            if (targets.isEmpty()) continue;

            Set<String> refs = new LinkedHashSet<>();
            collectRefs(res.path("expressions"), refs);
            res.path("depends_on").forEach(d -> refs.add(d.asText()));

            for (String ref : refs)
                for (String dep : resolve(ref, prefix, outputs))
                    for (String from : byBase.getOrDefault(dep, List.of()))
                        for (String to : targets)
                            if (!from.equals(to)) edges.add(new Model.Edge(from, to));
        }
        module.path("module_calls").fields().forEachRemaining(e ->
            walk(e.getValue().path("module"), prefix + "module." + e.getKey() + ".", byBase, outputs, edges));
    }

    // outputs de cada módulo → recursos a los que apuntan (hijos primero)
    private void collectOutputs(JsonNode module, String prefix, Map<String, Set<String>> outputs) {
        module.path("module_calls").fields().forEachRemaining(e -> {
            String childPrefix = prefix + "module." + e.getKey() + ".";
            JsonNode child = e.getValue().path("module");
            collectOutputs(child, childPrefix, outputs);
            child.path("outputs").fields().forEachRemaining(o -> {
                Set<String> refs = new LinkedHashSet<>();
                collectRefs(o.getValue().path("expression"), refs);
                Set<String> resolved = new LinkedHashSet<>();
                for (String r : refs) resolved.addAll(resolve(r, childPrefix, outputs));
                outputs.put(childPrefix + o.getKey(), resolved);
            });
        });
    }

    // "aws_vpc.main.id" → ["module.x.aws_vpc.main"]; "module.red.subnet_id" → recursos del output
    private Set<String> resolve(String ref, String prefix, Map<String, Set<String>> outputs) {
        String[] p = ref.split("\\.");
        if (p.length < 2) return Set.of();
        switch (p[0]) {
            case "var", "local", "data", "path", "each", "count", "self", "terraform": return Set.of();
            case "module":
                return p.length >= 3
                    ? outputs.getOrDefault(prefix + "module." + p[1] + "." + p[2], Set.of())
                    : Set.of();
            default: return Set.of(prefix + p[0] + "." + p[1]);
        }
    }

    private void collectRefs(JsonNode n, Set<String> out) {
        if (n.has("references")) n.get("references").forEach(r -> out.add(r.asText()));
        n.forEach(c -> collectRefs(c, out));
    }

    private String base(String id) { return id.replaceAll("\\[[^\\]]*\\]", ""); }
}