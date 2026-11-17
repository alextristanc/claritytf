package claritytf;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

final class TestAssertions {
    private TestAssertions() {}

    private static final Set<String> ACTIONS = Set.of("create", "update", "delete", "replace", "no-op");

    static void assertInvariants(Model.GraphModel m) {
        assertInvariants(m, "");
    }

    // Invariantes del contrato: grafo consistente, sin duplicados ni referencias rotas.
    static void assertInvariants(Model.GraphModel m, String context) {
        String where = context.isEmpty() ? "" : " [" + context + "]";

        Set<String> nodeIds = new HashSet<>();
        for (var n : m.nodes()) {
            assertTrue(nodeIds.add(n.id()), "id de nodo duplicado: " + n.id() + where);
            assertTrue(ACTIONS.contains(n.action()),
                "acción inválida en " + n.id() + ": " + n.action() + where);
        }

        Set<String> moduleIds = m.modules().stream()
            .map(Model.ModuleRef::id).collect(Collectors.toSet());
        for (var mod : m.modules()) {
            if (mod.parent() != null)
                assertTrue(moduleIds.contains(mod.parent()),
                    "module.parent inexistente: " + mod.parent() + where);
        }

        for (var n : m.nodes()) {
            if (n.module() != null)
                assertTrue(moduleIds.contains(n.module()),
                    "node.module inexistente: " + n.module() + where);
        }

        Set<Model.Edge> seen = new HashSet<>();
        for (var e : m.edges()) {
            assertTrue(nodeIds.contains(e.from()), "origen de arista inexistente: " + e.from() + where);
            assertTrue(nodeIds.contains(e.to()), "destino de arista inexistente: " + e.to() + where);
            assertNotEquals(e.from(), e.to(), "autoarista: " + e.from() + where);
            assertTrue(seen.add(e), "arista duplicada: " + e + where);
        }
    }
}
