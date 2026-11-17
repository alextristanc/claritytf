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
        // Repetir hasta que las salidas se estabilicen: un output puede depender de
        // otro módulo que todavía no se ha procesado. Tope de seguridad: 50 pasadas.
        for (int i = 0; i < 50; i++) {
            Map<String, Set<String>> before = new HashMap<>(outputs);
            collectOutputs(rootModule, "", Map.of(), outputs);
            if (before.equals(outputs)) break;
        }

        Set<Model.Edge> edges = new LinkedHashSet<>();
        walk(rootModule, "", Map.of(), byBase, outputs, edges);
        return new ArrayList<>(edges);
    }

    private void walk(JsonNode module, String prefix, Map<String, Set<String>> vars,
                    Map<String, List<String>> byBase, Map<String, Set<String>> outputs,
                    Set<Model.Edge> edges) {
        for (JsonNode res : module.path("resources")) {
            List<String> targets = byBase.getOrDefault(prefix + res.path("address").asText(), List.of());
            if (targets.isEmpty()) continue;

            // Solo las expresiones: una referencia suelta "module.x" no se expande aquí,
            // únicamente las salidas concretas ("module.x.output") generan aristas.
            Set<String> refs = new LinkedHashSet<>();
            collectRefs(res.path("expressions"), refs);
            Set<String> deps = new LinkedHashSet<>();
            for (String ref : refs) deps.addAll(resolve(ref, prefix, vars, outputs));

            // depends_on: una entrada "module.x" sí expande a todos los recursos del módulo.
            for (JsonNode d : res.path("depends_on"))
                deps.addAll(resolveDependsOn(d.asText(), prefix, vars, outputs, byBase));

            addEdges(deps, targets, byBase, edges);
        }
        module.path("module_calls").fields().forEachRemaining(e -> {
            String childPrefix = prefix + "module." + e.getKey() + ".";
            Map<String, Set<String>> childVars = inputs(e.getValue(), prefix, vars, outputs);

            // depends_on del module_call: todos los recursos del módulo dependen de lo listado.
            Set<String> callDeps = new LinkedHashSet<>();
            for (JsonNode d : e.getValue().path("depends_on"))
                callDeps.addAll(resolveDependsOn(d.asText(), prefix, vars, outputs, byBase));
            if (!callDeps.isEmpty()) addEdges(callDeps, nodesIn(byBase, childPrefix), byBase, edges);

            walk(e.getValue().path("module"), childPrefix, childVars, byBase, outputs, edges);
        });
    }

    private void addEdges(Set<String> deps, List<String> targets, Map<String, List<String>> byBase,
                          Set<Model.Edge> edges) {
        for (String dep : deps)
            for (String from : byBase.getOrDefault(dep, List.of()))
                for (String to : targets)
                    if (!from.equals(to)) edges.add(new Model.Edge(from, to));
    }

    // Ids de nodo cuyo módulo empieza por el prefijo (incluye módulos anidados).
    private List<String> nodesIn(Map<String, List<String>> byBase, String prefix) {
        List<String> out = new ArrayList<>();
        for (var e : byBase.entrySet())
            if (e.getKey().startsWith(prefix)) out.addAll(e.getValue());
        return out;
    }

    // depends_on: "module.x" expande a todos los recursos de ese módulo (anidados incluidos).
    private Set<String> resolveDependsOn(String ref, String prefix, Map<String, Set<String>> vars,
                                         Map<String, Set<String>> outputs,
                                         Map<String, List<String>> byBase) {
        String[] p = base(ref).split("\\.");
        if (p.length == 2 && "module".equals(p[0])) {
            Set<String> out = new LinkedHashSet<>();
            String modulePrefix = prefix + "module." + p[1] + ".";
            for (String key : byBase.keySet())
                if (key.startsWith(modulePrefix)) out.add(key);
            return out;
        }
        return resolve(ref, prefix, vars, outputs);
    }

    // Entradas de un módulo: variable → recursos (del ámbito padre) de los que depende
    private Map<String, Set<String>> inputs(JsonNode call, String parentPrefix,
            Map<String, Set<String>> parentVars, Map<String, Set<String>> outputs) {
        Map<String, Set<String>> in = new HashMap<>();
        call.path("expressions").fields().forEachRemaining(f -> {
            Set<String> refs = new LinkedHashSet<>();
            collectRefs(f.getValue(), refs);
            Set<String> deps = new LinkedHashSet<>();
            for (String r : refs) deps.addAll(resolve(r, parentPrefix, parentVars, outputs));
            in.put(f.getKey(), deps);
        });
        return in;
    }

    // Outputs de cada módulo → recursos a los que apuntan (hijos primero)
    private void collectOutputs(JsonNode module, String prefix, Map<String, Set<String>> vars,
                                Map<String, Set<String>> outputs) {
        module.path("module_calls").fields().forEachRemaining(e -> {
            String childPrefix = prefix + "module." + e.getKey() + ".";
            JsonNode child = e.getValue().path("module");
            Map<String, Set<String>> childVars = inputs(e.getValue(), prefix, vars, outputs);
            collectOutputs(child, childPrefix, childVars, outputs);
            child.path("outputs").fields().forEachRemaining(o -> {
                Set<String> refs = new LinkedHashSet<>();
                collectRefs(o.getValue().path("expression"), refs);
                Set<String> resolved = new LinkedHashSet<>();
                for (String r : refs) resolved.addAll(resolve(r, childPrefix, childVars, outputs));
                outputs.put(childPrefix + o.getKey(), resolved);
            });
        });
    }

    // "aws_vpc.main[0].id" → ["<prefijo>aws_vpc.main"]; "var.x" → lo que alimenta esa variable
    private Set<String> resolve(String ref, String prefix, Map<String, Set<String>> vars,
                                Map<String, Set<String>> outputs) {
        String[] p = base(ref).split("\\.");   // sin índices: también cubre claves de for_each con puntos
        if (p.length < 2) return Set.of();
        switch (p[0]) {
            case "var": return vars.getOrDefault(p[1], Set.of());
            case "local", "data", "path", "each", "count", "self", "terraform": return Set.of();
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