package claritytf;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;

public final class Model {
    private Model() {}

    // action: "create" | "update" | "delete" | "replace" | "no-op"
    public record Node(String id, String type, String name,
                       String module, String action, JsonNode values) {}
    public record Edge(String from, String to) {}
    public record ModuleRef(String id, String parent) {}
    public record GraphModel(int schemaVersion, List<Node> nodes, List<Edge> edges,
                             List<ModuleRef> modules, List<String> warnings) {}
}