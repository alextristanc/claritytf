package claritytf;

import static claritytf.TestAssertions.assertInvariants;
import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

class PlanParserTest {
    private final PlanParser parser = new PlanParser();

    private byte[] fixture(String name) throws Exception {
        try (var in = getClass().getResourceAsStream("/fixtures/" + name)) {
            if (in == null) throw new AssertionError("Fixture no encontrado: /fixtures/" + name);
            return in.readAllBytes();
        }
    }

    // Recorre todos los fixtures válidos y comprueba los invariantes del grafo.
    @Test void todosLosFixturesCumplenInvariantes() throws Exception {
        var dir = getClass().getResource("/fixtures");
        assertNotNull(dir, "No se encontró el directorio /fixtures");
        try (var files = Files.list(Path.of(dir.toURI()))) {
            List<Path> jsons = files
                .filter(p -> p.getFileName().toString().endsWith(".json"))
                .sorted()
                .toList();
            assertFalse(jsons.isEmpty(), "No hay fixtures para validar");
            for (Path p : jsons) {
                String name = p.getFileName().toString();
                var m = parser.parse(Files.readAllBytes(p));
                assertInvariants(m, name);
                assertEquals(1, m.schemaVersion(), "schemaVersion inesperado en " + name);
            }
        }
    }

    @Test void planConModulo() throws Exception {
        var m = parser.parse(fixture("plan.json"));
        assertEquals(3, m.nodes().size());
        assertEquals(1, m.modules().size());
        assertEquals("module.red", m.modules().get(0).id());
        assertInvariants(m);
    }

    @Test void planConTresAcciones() throws Exception {
        var m = parser.parse(fixture("plan-cambios.json"));
        var acciones = m.nodes().stream().map(Model.Node::action).collect(Collectors.toSet());
        assertEquals(Set.of("create", "update", "delete"), acciones);
        assertInvariants(m);
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
        assertInvariants(m);
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
        assertInvariants(m);
    }

    @Test void planVacio() {
        var e = assertThrows(PlanException.class, () -> parser.parse(String.format(BASE, "[]").getBytes()));
        assertEquals(PlanException.Code.EMPTY_PLAN, e.code);
    }

    @Test void planSoloConDataSourcesSeRechaza() {
        String rc = "[{\"address\":\"data.aws_ami.ubuntu\",\"mode\":\"data\",\"type\":\"aws_ami\",\"name\":\"ubuntu\","
            + "\"change\":{\"actions\":[\"read\"],\"after\":{}}}]";
        var e = assertThrows(PlanException.class, () -> parser.parse(String.format(BASE, rc).getBytes()));
        assertEquals(PlanException.Code.EMPTY_PLAN, e.code);
    }

    @Test void replaceSeDetecta() {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"delete\",\"create\"],\"after\":{}}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals("replace", m.nodes().get(0).action());
        assertInvariants(m);
    }

    @Test void accionDesconocidaGeneraAdvertencia() throws Exception {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"read\"]}}]";
        String json = String.format(BASE, rc);
        var m = new GraphExtractor().extract(new ObjectMapper().readTree(json));
        assertTrue(m.nodes().isEmpty());
        assertEquals(1, m.warnings().size());
        // Sin nodos representables, el parser rechaza el plan
        var e = assertThrows(PlanException.class, () -> parser.parse(json.getBytes()));
        assertEquals(PlanException.Code.EMPTY_PLAN, e.code);
    }

    @Test void tipoDesconocidoSeDibuja() {
        String rc = "[{\"address\":\"zzz.x\",\"type\":\"zzz_raro\",\"name\":\"x\",\"change\":{\"actions\":[\"create\"],\"after\":{}}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals(1, m.nodes().size());
        assertEquals("zzz_raro", m.nodes().get(0).type());
        assertInvariants(m);
    }

    @Test void recursoSinAddressGeneraAdvertencia() {
        String rc = "[{\"type\":\"a\",\"name\":\"sin\",\"change\":{\"actions\":[\"create\"],\"after\":{}}},"
            + "{\"address\":\"b.y\",\"type\":\"b\",\"name\":\"y\",\"change\":{\"actions\":[\"create\"],\"after\":{}}}]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals(1, m.nodes().size());
        assertTrue(m.warnings().stream().anyMatch(w -> w.contains("address")),
            "Se esperaba una advertencia por el recurso sin address: " + m.warnings());
        assertInvariants(m);
    }

    @Test void addressDuplicadaGeneraAdvertencia() {
        String uno = "{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"create\"],\"after\":{}}}";
        var m = parser.parse(String.format(BASE, "[" + uno + "," + uno + "]").getBytes());
        assertEquals(1, m.nodes().size());
        assertTrue(m.warnings().stream().anyMatch(w -> w.toLowerCase().contains("duplicada")),
            "Se esperaba una advertencia por address duplicada: " + m.warnings());
        assertInvariants(m);
    }

    @Test void moduloConCountYForEach() throws Exception {
        var m = parser.parse(fixture("plan-dependencias.json"));
        assertTrue(m.nodes().stream().anyMatch(n -> n.id().equals("module.subredes[0].aws_subnet.b")));
        assertTrue(m.nodes().stream().anyMatch(n -> n.id().equals("module.subredes[1].aws_subnet.b")));
        assertTrue(m.nodes().stream().anyMatch(n -> n.id().equals("module.seguridad[\"web\"].aws_security_group.web")));
        assertTrue(m.modules().stream().anyMatch(x -> x.id().equals("module.seguridad[\"db\"]")));
        assertInvariants(m);
    }

    @Test void dependsOnDeModulosCompletos() throws Exception {
        var m = parser.parse(fixture("plan-dependencias.json"));
        // (b) depends_on del module_call: la VPC precede a todos los recursos de base.
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.base.aws_route_table.rt")));
        // (a) depends_on = [module.base] en un recurso: aristas desde todos los recursos del módulo.
        assertTrue(m.edges().contains(new Model.Edge("module.base.aws_subnet.a[0]", "aws_instance.app")));
        assertTrue(m.edges().contains(new Model.Edge("module.base.aws_subnet.a[1]", "aws_instance.app")));
        assertTrue(m.edges().contains(new Model.Edge("module.base.aws_route_table.rt", "aws_instance.app")));
        // (c) una referencia "module.seguridad" suelta no expande el módulo.
        assertTrue(m.edges().stream().noneMatch(e -> e.to().startsWith("aws_cloudwatch_log_group")),
            "module.seguridad suelto no debe crear aristas hacia el log group");
        assertInvariants(m);
    }
}
