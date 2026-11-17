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
                assertEquals(2, m.schemaVersion(), "schemaVersion inesperado en " + name);
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
        assertEquals(4, m.nodes().size());
        assertEquals(2, m.modules().size());
        assertEquals(3, m.edges().size());
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.red.aws_subnet.a")));
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.red.module.seguridad.aws_security_group.web")));
        assertTrue(m.edges().contains(new Model.Edge("module.red.aws_subnet.a", "aws_instance.web")));
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
        assertTrue(m.nodes().stream().anyMatch(n -> n.id().equals("module.subredes.aws_subnet.b")));
        assertTrue(m.nodes().stream().anyMatch(n -> n.id().equals("module.seguridad.aws_security_group.web")));
        // count y for_each: cada llamada agrupa sus instancias con claves.
        assertEquals(2, module(m, "module.subredes").instances());
        assertEquals(2, module(m, "module.seguridad").instances());
        assertEquals(2, module(m, "module.seguridad.module.reglas").instances());
        assertInvariants(m);
    }

    private static Model.ModuleRef module(Model.GraphModel m, String id) {
        return m.modules().stream().filter(x -> x.id().equals(id)).findFirst()
            .orElseThrow(() -> new AssertionError("Módulo no encontrado: " + id));
    }

    @Test void instanciasConAccionesMixtasSeAgrupan() {
        String rc = "["
            + "{\"address\":\"aws_instance.web[0]\",\"mode\":\"managed\",\"type\":\"aws_instance\",\"name\":\"web\","
            + "\"change\":{\"actions\":[\"create\"],\"after\":{\"id\":\"i-0\"}}},"
            + "{\"address\":\"aws_instance.web[1]\",\"mode\":\"managed\",\"type\":\"aws_instance\",\"name\":\"web\","
            + "\"change\":{\"actions\":[\"delete\"],\"before\":{\"id\":\"i-1\"}}}"
            + "]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals(1, m.nodes().size());
        var n = m.nodes().get(0);
        assertEquals("aws_instance.web", n.id());
        assertEquals("mixed", n.action());
        assertEquals(2, n.instances().size());
        assertEquals(List.of("create", "delete"),
            n.instances().stream().map(Model.Instance::action).toList());
        // En delete, values sale de before.
        assertEquals("i-1", n.instances().get(1).values().path("id").asText());
        assertInvariants(m);
    }

    @Test void atributosDesconocidosYSensibles() throws Exception {
        var m = parser.parse(fixture("plan-sensible.json"));
        var db = m.nodes().stream()
            .filter(n -> n.id().equals("aws_db_instance.main")).findFirst().orElseThrow();
        assertEquals("create", db.action());
        var inst = db.instances().get(0);

        // true directo y un array de objetos que contiene true; false no cuenta.
        assertEquals(List.of("arn", "id", "endpoint"), inst.unknown());
        // true directo y un objeto anidado con true; un objeto vacío no cuenta.
        assertEquals(List.of("password", "connection"), inst.sensitive());

        assertFalse(inst.values().has("password"), "values no debe incluir atributos sensibles");
        assertFalse(inst.values().has("connection"), "values no debe incluir atributos sensibles");
        assertEquals("admin", inst.values().path("username").asText());
        assertTrue(inst.values().has("tags"), "un objeto sensible vacío no debe ocultar el valor");
        assertInvariants(m);
    }

    @Test void referenciasLocalYDataSeMarcan() throws Exception {
        var m = parser.parse(fixture("plan-sensible.json"));
        assertEquals(List.of("data.aws_subnet", "local.vpc_id"), node(m, "aws_db_instance.main").unresolved());
        assertEquals(List.of("local.vpc_id"), node(m, "aws_security_group.web").unresolved());
        // La referencia normalizada no crea aristas, pero las expresiones sí.
        assertTrue(m.edges().contains(new Model.Edge("aws_security_group.web", "aws_db_instance.main")));
        assertInvariants(m);
    }

    private static Model.Node node(Model.GraphModel m, String id) {
        return m.nodes().stream().filter(n -> n.id().equals(id)).findFirst()
            .orElseThrow(() -> new AssertionError("Nodo no encontrado: " + id));
    }

    @Test void moduloConForEachCuentaInstancias() {
        String rc = "[" + resourceChange("module.servicios[\"db\"].aws_instance.api", "module.servicios[\"db\"]") + ","
            + resourceChange("module.servicios[\"web\"].aws_instance.api", "module.servicios[\"web\"]") + ","
            + resourceChange("module.servicios[\"a.b\"].aws_instance.api", "module.servicios[\"a.b\"]") + "]";
        var m = parser.parse(String.format(BASE, rc).getBytes());
        assertEquals(1, m.nodes().size());
        var n = m.nodes().get(0);
        assertEquals("module.servicios.aws_instance.api", n.id());
        assertEquals("module.servicios", n.module());
        assertEquals(3, n.instances().size());
        assertEquals(1, m.modules().size());
        var mod = m.modules().get(0);
        assertEquals("module.servicios", mod.id());
        assertNull(mod.parent());
        assertEquals(3, mod.instances(), "for_each con 3 claves debe dar 3 instancias");
        assertInvariants(m);
    }

    private static String resourceChange(String address, String moduleAddress) {
        // address/moduleAddress llevan comillas en las claves for_each: escaparlas para el JSON.
        return """
            {"address":"%s","module_address":"%s","mode":"managed","type":"aws_instance","name":"api",
             "change":{"actions":["create"],"after":{}}}
            """.formatted(address.replace("\"", "\\\""), moduleAddress.replace("\"", "\\\""));
    }

    @Test void stripKeysRespetaPuntosYComillasEnClaves() {
        assertEquals("aws_instance.web", GraphExtractor.stripKeys("aws_instance.web[\"a.b\"]"));
        assertEquals("module.m.module.n.aws_x.y",
            GraphExtractor.stripKeys("module.m[\"x.y\"].module.n[0].aws_x.y"));
        assertEquals("module.m.aws_x.y",
            GraphExtractor.stripKeys("module.m[\"a\\\"b\"].aws_x.y"));
    }

    @Test void planIncompletoOConErroresAdvierte() {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\","
            + "\"change\":{\"actions\":[\"create\"],\"after\":{}}}]";
        String plan = "{\"format_version\":\"1.2\",%s\"resource_changes\":%s,"
            + "\"configuration\":{\"root_module\":{}}}";

        var incompleto = parser.parse(String.format(plan, "\"complete\":false,", rc).getBytes());
        assertTrue(incompleto.warnings().stream().anyMatch(w -> w.contains("incompleto")),
            "complete: false debe advertir: " + incompleto.warnings());

        var errored = parser.parse(String.format(plan, "\"errored\":true,", rc).getBytes());
        assertTrue(errored.warnings().stream().anyMatch(w -> w.contains("errored")),
            "errored: true debe advertir: " + errored.warnings());

        // true/false o campos ausentes son neutros.
        var neutro = parser.parse(String.format(plan, "\"complete\":true,\"errored\":false,", rc).getBytes());
        assertTrue(neutro.warnings().isEmpty(), "true/false no deben advertir: " + neutro.warnings());

        var ausente = parser.parse(String.format(plan, "", rc).getBytes());
        assertTrue(ausente.warnings().isEmpty(), "campos ausentes no deben advertir: " + ausente.warnings());
    }

    @Test void versionDeFormato() {
        String rc = "[{\"address\":\"a.x\",\"type\":\"a\",\"name\":\"x\",\"change\":{\"actions\":[\"create\"],\"after\":{}}}]";
        String conVersion = "{\"format_version\":\"%s\",\"resource_changes\":%s,\"configuration\":{\"root_module\":{}}}";

        var soportada = parser.parse(String.format(conVersion, "1.2", rc).getBytes());
        assertTrue(soportada.warnings().stream().noneMatch(w -> w.contains("format_version")),
            "1.x no debe advertir: " + soportada.warnings());

        var futura = parser.parse(String.format(conVersion, "2.0", rc).getBytes());
        assertTrue(futura.warnings().stream().anyMatch(w -> w.contains("format_version")),
            "2.0 debe advertir: " + futura.warnings());

        var ausente = parser.parse(String.format(BASE, rc).getBytes());
        assertTrue(ausente.warnings().stream().anyMatch(w -> w.contains("format_version")),
            "Sin format_version debe advertir: " + ausente.warnings());
    }

    @Test void dependsOnDeModulosCompletos() throws Exception {
        var m = parser.parse(fixture("plan-dependencias.json"));
        // (b) depends_on del module_call: la VPC precede a todos los recursos de base.
        assertTrue(m.edges().contains(new Model.Edge("aws_vpc.main", "module.base.aws_route_table.rt")));
        // (a) depends_on = [module.base] en un recurso: aristas desde todos los recursos del módulo.
        assertTrue(m.edges().contains(new Model.Edge("module.base.aws_subnet.a", "aws_instance.app")));
        assertTrue(m.edges().contains(new Model.Edge("module.base.aws_route_table.rt", "aws_instance.app")));
        // (c) una referencia "module.seguridad" suelta no expande el módulo.
        assertTrue(m.edges().stream().noneMatch(e -> e.to().startsWith("aws_cloudwatch_log_group")),
            "module.seguridad suelto no debe crear aristas hacia el log group");
        assertInvariants(m);
    }
}
