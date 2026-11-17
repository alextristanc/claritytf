package claritytf;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

final class TestAssertions {
    private TestAssertions() {}

    // Acciones de una instancia concreta; "mixed" solo puede ser la acción del bloque.
    private static final Set<String> ACTIONS =
        Set.of("create", "update", "delete", "replace", "no-op");
    private static final Set<String> BLOCK_ACTIONS =
        Set.of("create", "update", "delete", "replace", "no-op", "mixed");

    static void assertInvariants(Model.GraphModel m) {
        assertInvariants(m, "");
    }

    // Invariantes del contrato: grafo consistente, sin duplicados ni referencias rotas.
    static void assertInvariants(Model.GraphModel m, String context) {
        String where = context.isEmpty() ? "" : " [" + context + "]";

        Set<String> nodeIds = new HashSet<>();
        for (var n : m.nodes()) {
            assertTrue(nodeIds.add(n.id()), "id de nodo duplicado: " + n.id() + where);
            assertTrue(BLOCK_ACTIONS.contains(n.action()),
                "acción de bloque inválida en " + n.id() + ": " + n.action() + where);
            assertFalse(n.instances().isEmpty(),
                "bloque sin instancias: " + n.id() + where);

            Set<String> instanceActions = new HashSet<>();
            Set<String> addresses = new HashSet<>();
            for (var i : n.instances()) {
                assertTrue(addresses.add(i.address()),
                    "instancia duplicada en " + n.id() + ": " + i.address() + where);
                assertFalse(i.address().isEmpty(),
                    "instancia sin address en " + n.id() + where);
                assertEquals(n.id(), GraphExtractor.stripKeys(i.address()),
                    "la instancia no pertenece al bloque " + n.id() + ": " + i.address() + where);
                assertTrue(ACTIONS.contains(i.action()),
                    "acción de instancia inválida en " + i.address() + ": " + i.action() + where);
                instanceActions.add(i.action());
                assertFalse(i.unknown().contains(null),
                    "unknown con valor nulo en " + i.address() + where);
                assertEquals(i.unknown().size(), Set.copyOf(i.unknown()).size(),
                    "unknown duplicado en " + i.address() + where);
                assertEquals(i.sensitive().size(), Set.copyOf(i.sensitive()).size(),
                    "sensitive duplicado en " + i.address() + where);
            }

            String expected = instanceActions.size() == 1
                ? instanceActions.iterator().next() : "mixed";
            assertEquals(expected, n.action(),
                "acción de bloque incoherente con sus instancias en " + n.id() + where);

            assertEquals(n.unresolved().size(), Set.copyOf(n.unresolved()).size(),
                "unresolved duplicado en " + n.id() + where);
            for (String ref : n.unresolved())
                assertTrue(ref.matches("(local|data)\\.[^.]+"),
                    "referencia no normalizada en " + n.id() + ": " + ref + where);
        }

        Set<String> moduleIds = m.modules().stream()
            .map(Model.ModuleRef::id).collect(Collectors.toSet());
        for (var mod : m.modules()) {
            assertTrue(mod.instances() >= 1,
                "module.instances debe ser >= 1: " + mod.id() + where);
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
