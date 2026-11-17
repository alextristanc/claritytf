package claritytf;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.*;

public class GraphExtractor {

    public Model.GraphModel extract(JsonNode root) {
        List<String> warnings = new ArrayList<>();
        List<Model.Node> nodes = extractNodes(root, warnings);
        List<Model.Edge> edges = extractEdges(root, nodes);
        return new Model.GraphModel(2, nodes, edges, extractModules(root), warnings);
    }

    private List<Model.Node> extractNodes(JsonNode root, List<String> warnings) {
        Map<String, List<Model.Instance>> byBlock = new LinkedHashMap<>();
        Map<String, String> types = new HashMap<>();
        Map<String, String> names = new HashMap<>();
        Map<String, String> modules = new HashMap<>();
        Set<String> seenAddresses = new HashSet<>();

        for (JsonNode rc : root.path("resource_changes")) {
            if ("data".equals(rc.path("mode").asText())) continue;
            String address = rc.path("address").asText("");
            if (address.isEmpty()) { warnings.add("Recurso sin address omitido"); continue; }
            if (!seenAddresses.add(address)) { warnings.add("Dirección duplicada omitida: " + address); continue; }

            JsonNode change = rc.path("change");
            String action = toAction(change.path("actions"));
            if (action == null) { warnings.add("Acción no soportada en " + address); continue; }

            boolean delete = "delete".equals(action);
            JsonNode rawValues = delete ? change.path("before") : change.path("after");
            List<String> sensitive = flagged(
                delete ? change.path("before_sensitive") : change.path("after_sensitive"));
            List<String> unknown = flagged(change.path("after_unknown"));

            String id = stripKeys(address);
            byBlock.computeIfAbsent(id, k -> new ArrayList<>())
                .add(new Model.Instance(address, action, withoutSensitive(rawValues, sensitive),
                    unknown, sensitive));
            types.put(id, rc.path("type").asText(""));
            names.put(id, rc.path("name").asText(""));
            String moduleAddress = rc.path("module_address").asText("");
            modules.put(id, moduleAddress.isEmpty() ? null : stripKeys(moduleAddress));
        }

        Map<String, List<String>> unresolved = unresolvedByBlock(root);
        List<Model.Node> nodes = new ArrayList<>();
        for (var e : byBlock.entrySet()) {
            String id = e.getKey();
            nodes.add(new Model.Node(id, types.get(id), names.get(id), modules.get(id),
                aggregateAction(e.getValue()), e.getValue(),
                unresolved.getOrDefault(id, List.of())));
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

    // Si todas las instancias coinciden se devuelve esa acción; si no, "mixed".
    private String aggregateAction(List<Model.Instance> instances) {
        String first = instances.get(0).action();
        for (var i : instances)
            if (!i.action().equals(first)) return "mixed";
        return first;
    }

    // Claves de primer nivel marcadas con true o con un objeto/array que contenga true.
    private List<String> flagged(JsonNode node) {
        List<String> out = new ArrayList<>();
        if (node == null || !node.isObject()) return out;
        node.fields().forEachRemaining(e -> {
            if (containsTrue(e.getValue())) out.add(e.getKey());
        });
        return out;
    }

    private boolean containsTrue(JsonNode n) {
        if (n.isBoolean()) return n.booleanValue();
        if (n.isArray() || n.isObject())
            for (JsonNode child : n)
                if (containsTrue(child)) return true;
        return false;
    }

    // values = after (o before en delete) sin los atributos sensibles.
    private JsonNode withoutSensitive(JsonNode raw, List<String> sensitive) {
        if (raw == null || raw.isMissingNode() || raw.isNull()) return null;
        if (sensitive.isEmpty() || !raw.isObject()) return raw;
        ObjectNode copy = raw.deepCopy();
        for (String key : sensitive) copy.remove(key);
        return copy;
    }

    // local.* / data.* citadas en las expresiones del propio recurso, normalizadas a dos segmentos.
    private Map<String, List<String>> unresolvedByBlock(JsonNode root) {
        Map<String, List<String>> out = new HashMap<>();
        collectUnresolved(root.path("configuration").path("root_module"), "", out);
        return out;
    }

    private void collectUnresolved(JsonNode module, String prefix, Map<String, List<String>> out) {
        for (JsonNode res : module.path("resources")) {
            String id = prefix + res.path("address").asText();
            Set<String> refs = new LinkedHashSet<>();
            collectRefs(res.path("expressions"), refs);
            List<String> list = new ArrayList<>();
            for (String ref : refs) {
                String[] p = stripKeys(ref).split("\\.");
                if (p.length >= 2 && ("local".equals(p[0]) || "data".equals(p[0]))) {
                    String normalized = p[0] + "." + p[1];
                    if (!list.contains(normalized)) list.add(normalized);
                }
            }
            if (!list.isEmpty()) out.put(id, list);
        }
        module.path("module_calls").fields().forEachRemaining(e ->
            collectUnresolved(e.getValue().path("module"), prefix + "module." + e.getKey() + ".", out));
    }

    // Módulos y sus padres, con el número de instancias (module_address con claves) de cada llamada.
    private List<Model.ModuleRef> extractModules(JsonNode root) {
        Map<String, Set<String>> addresses = new LinkedHashMap<>();
        for (JsonNode rc : root.path("resource_changes")) {
            if ("data".equals(rc.path("mode").asText())) continue;
            String address = rc.path("module_address").asText("");
            while (!address.isEmpty()) {
                addresses.computeIfAbsent(stripKeys(address), k -> new LinkedHashSet<>()).add(address);
                address = parentModuleAddress(address);
            }
        }
        List<Model.ModuleRef> out = new ArrayList<>();
        for (var e : addresses.entrySet()) {
            String id = e.getKey();
            int i = id.lastIndexOf(".module.");
            out.add(new Model.ModuleRef(id, i < 0 ? null : id.substring(0, i), e.getValue().size()));
        }
        return out;
    }

    private String parentModuleAddress(String address) {
        int cut = lastModuleSeparator(address);
        return cut < 0 ? "" : address.substring(0, cut);
    }

    // Último ".module." fuera de corchetes (las claves de for_each pueden contener puntos).
    private int lastModuleSeparator(String address) {
        int depth = 0;
        char quote = 0;
        int last = -1;
        for (int i = 0; i < address.length(); i++) {
            char c = address.charAt(i);
            if (quote != 0) {
                if (c == '\\') i++;
                else if (c == quote) quote = 0;
                continue;
            }
            if (c == '"') { quote = c; continue; }
            if (c == '[') { depth++; continue; }
            if (c == ']') { depth = Math.max(0, depth - 1); continue; }
            if (depth == 0 && address.startsWith(".module.", i)) last = i;
        }
        return last;
    }

    private List<Model.Edge> extractEdges(JsonNode root, List<Model.Node> nodes) {
        Map<String, List<String>> byBlock = new HashMap<>();
        for (var n : nodes) byBlock.computeIfAbsent(n.id(), k -> new ArrayList<>()).add(n.id());

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
        walk(rootModule, "", Map.of(), byBlock, outputs, edges);
        return new ArrayList<>(edges);
    }

    private void walk(JsonNode module, String prefix, Map<String, Set<String>> vars,
                    Map<String, List<String>> byBlock, Map<String, Set<String>> outputs,
                    Set<Model.Edge> edges) {
        for (JsonNode res : module.path("resources")) {
            List<String> targets = byBlock.getOrDefault(prefix + res.path("address").asText(), List.of());
            if (targets.isEmpty()) continue;

            // Solo las expresiones: una referencia suelta "module.x" no se expande aquí,
            // únicamente las salidas concretas ("module.x.output") generan aristas.
            Set<String> refs = new LinkedHashSet<>();
            collectRefs(res.path("expressions"), refs);
            Set<String> deps = new LinkedHashSet<>();
            for (String ref : refs) deps.addAll(resolve(ref, prefix, vars, outputs));

            // depends_on: una entrada "module.x" sí expande a todos los recursos del módulo.
            for (JsonNode d : res.path("depends_on"))
                deps.addAll(resolveDependsOn(d.asText(), prefix, vars, outputs, byBlock));

            addEdges(deps, targets, byBlock, edges);
        }
        module.path("module_calls").fields().forEachRemaining(e -> {
            String childPrefix = prefix + "module." + e.getKey() + ".";
            Map<String, Set<String>> childVars = inputs(e.getValue(), prefix, vars, outputs);

            // depends_on del module_call: todos los recursos del módulo dependen de lo listado.
            Set<String> callDeps = new LinkedHashSet<>();
            for (JsonNode d : e.getValue().path("depends_on"))
                callDeps.addAll(resolveDependsOn(d.asText(), prefix, vars, outputs, byBlock));
            if (!callDeps.isEmpty()) addEdges(callDeps, nodesIn(byBlock, childPrefix), byBlock, edges);

            walk(e.getValue().path("module"), childPrefix, childVars, byBlock, outputs, edges);
        });
    }

    private void addEdges(Set<String> deps, List<String> targets, Map<String, List<String>> byBlock,
                          Set<Model.Edge> edges) {
        for (String dep : deps)
            for (String from : byBlock.getOrDefault(dep, List.of()))
                for (String to : targets)
                    if (!from.equals(to)) edges.add(new Model.Edge(from, to));
    }

    // Ids de nodo cuyo módulo empieza por el prefijo (incluye módulos anidados).
    private List<String> nodesIn(Map<String, List<String>> byBlock, String prefix) {
        List<String> out = new ArrayList<>();
        for (var e : byBlock.entrySet())
            if (e.getKey().startsWith(prefix)) out.addAll(e.getValue());
        return out;
    }

    // depends_on: "module.x" expande a todos los recursos de ese módulo (anidados incluidos).
    private Set<String> resolveDependsOn(String ref, String prefix, Map<String, Set<String>> vars,
                                         Map<String, Set<String>> outputs,
                                         Map<String, List<String>> byBlock) {
        String[] p = stripKeys(ref).split("\\.");
        if (p.length == 2 && "module".equals(p[0])) {
            Set<String> out = new LinkedHashSet<>();
            String modulePrefix = prefix + "module." + p[1] + ".";
            for (String key : byBlock.keySet())
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
        String[] p = stripKeys(ref).split("\\.");
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

    // Elimina claves de índice respetando comillas y puntos dentro de ellas:
    // aws_instance.web["a.b"] → aws_instance.web
    static String stripKeys(String id) {
        StringBuilder out = new StringBuilder(id.length());
        int depth = 0;
        char quote = 0;
        for (int i = 0; i < id.length(); i++) {
            char c = id.charAt(i);
            if (depth > 0) {
                if (quote != 0) {
                    if (c == '\\') i++;
                    else if (c == quote) quote = 0;
                } else if (c == '"' || c == '\'') {
                    quote = c;
                } else if (c == '[') {
                    depth++;
                } else if (c == ']') {
                    depth--;
                }
                continue;
            }
            if (c == '[') { depth = 1; continue; }
            out.append(c);
        }
        return out.toString();
    }
}
