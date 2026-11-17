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

    @Test void aristas() throws Exception {
    var m = parser.parse(fixture("plan.json"));
    assertEquals(2, m.edges().size());
    assertTrue(m.edges().contains(new Model.Edge("module.red.aws_vpc.main", "module.red.aws_subnet.a")));
    assertTrue(m.edges().contains(new Model.Edge("module.red.aws_subnet.a", "aws_instance.web")));
    }

    private static final String BASE =
        "{\"resource_changes\":%s,\"configuration\":{\"root_module\":{}}}";

    @Test void variablesDeModuloYAnidados() throws Exception {
        var m = parser.parse(fixture("plan-modulos.json"));
        assertEquals(6, m.nodes().size());
        assertEquals(2, m.modules().size());
        assertEquals(7, m.edges().size());
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.red.aws_subnet.a[0]")));
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.red.module.seguridad.aws_security_group.web")));
        assertTrue(m.edges().contains(new Model.Edge("module.red.aws_subnet.a[1]", "aws_instance.web[\"a\"]")));
    }

    @Test void planVacio() {
        var e = assertThrows(PlanException.class, () -> parser.parse(String.format(BASE, "[]").getBytes()));
        assertEquals(PlanException.Code.EMPTY_PLAN, e.code);
    }

    @Test void replaceSeDetecta() {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"delete\",\"create\"],\"after\":{}}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals("replace", m.nodes().get(0).action());
    }

    @Test void accionDesconocidaGeneraAdvertencia() {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"read\"]}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertTrue(m.nodes().isEmpty());
        assertEquals(1, m.warnings().size());
    }

    @Test void tipoDesconocidoSeDibuja() {
        String rc = "[{\"address\":\"zzz.x\",\"type\":\"zzz_raro\",\"name\":\"x\",\"change\":{\"actions\":[\"create\"],\"after\":{}}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals(1, m.nodes().size());
        assertEquals("zzz_raro", m.nodes().get(0).type());
    }        

}