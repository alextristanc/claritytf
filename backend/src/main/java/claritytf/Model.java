package claritytf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public final class Model {
    private Model() {}

    // action: "create" | "update" | "delete" | "replace" | "no-op" | "mixed"
    // Instancia concreta: address conserva claves; values va sin atributos sensibles.
    public record Instance(String address, String action, JsonNode values,
                           List<String> unknown, List<String> sensitive) {}

    // Bloque de configuración: id/module sin claves de índice.
    public record Node(String id, String type, String name, String module,
                       String action, List<Instance> instances, List<String> unresolved) {}
    public record Edge(String from, String to) {}
    public record ModuleRef(String id, String parent, int instances) {}
    public record GraphModel(int schemaVersion, List<Node> nodes, List<Edge> edges,
                             List<ModuleRef> modules, List<String> warnings) {}
}
