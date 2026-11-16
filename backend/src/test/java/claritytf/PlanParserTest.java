package claritytf;

import static org.junit.jupiter.api.Assertions.*;

import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class PlanParserTest {
    private final PlanParser parser = new PlanParser();

    private byte[] fixture(String name) throws Exception {
        try (var in = getClass().getResourceAsStream("/fixtures/" + name)) {
            return in.readAllBytes();
        }
    }

    @Test void planConModulo() throws Exception {
        var m = parser.parse(fixture("plan.json"));
        assertEquals(3, m.nodes().size());
        assertEquals(1, m.modules().size());
        assertEquals("module.red", m.modules().get(0).id());
    }

    @Test void planConTresAcciones() throws Exception {
        var m = parser.parse(fixture("plan-cambios.json"));
        var acciones = m.nodes().stream().map(Model.Node::action).collect(Collectors.toSet());
        assertEquals(Set.of("create", "update", "delete"), acciones);
    }

    @Test void jsonInvalido() {
        var e = assertThrows(PlanException.class, () -> parser.parse("hola".getBytes()));
        assertEquals(PlanException.Code.INVALID_JSON, e.code);
    }

    @Test void noEsUnPlan() {
        var e = assertThrows(PlanException.class, () -> parser.parse("{}".getBytes()));
        assertEquals(PlanException.Code.NOT_A_PLAN, e.code);
    }
}