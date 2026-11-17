# ClarityTF

> Arrastra tu plan de Terraform y ve, en 5 segundos, qué se crea, qué se rompe y qué depende de qué.

---

## 1. Descripción

Aplicación web que recibe el **plan JSON de Terraform** (`terraform show -json plan.tfplan`), identifica recursos, módulos y dependencias, y muestra un **diagrama interactivo** en el navegador.

Un backend Java procesa el JSON y devuelve un modelo simplificado `{schemaVersion, nodes, edges, modules, warnings}`. El frontend dibuja ese modelo. Solo el frontend se despliega públicamente; el backend corre local durante la demostración.

**Contexto del proyecto:** presentación en clase (con votación al proyecto más votado) y publicación en LinkedIn. 

## 2. En qué ayuda

- Ver de un vistazo **qué va a crear, actualizar o borrar** un plan.
- Ver **qué depende de qué**, y qué se afecta si cambias o borras un recurso.
- Entender la estructura de infraestructura con **módulos** sin leer el JSON.
- Consultar los detalles de cada bloque y de cada instancia en el panel lateral, incluidos los valores que se conocerán al aplicar y las dependencias no trazables.
- Probarlo **sin instalar nada** en modo demo (a diferencia de `terraform graph`, que exige Graphviz y entrega una imagen estática).

## 3. Qué lo diferencia

| Función | Valor |
|---|---|
| **Colores por acción** | Verde = create, amarillo = update, rojo = delete, azul = sin cambios, naranja = replace; gris con `◆` = acciones mixtas. |
| **Bloques, no instancias** | `count` y `for_each` se agrupan en su bloque con insignia `×N`; el panel lista cada instancia con su acción. |
| **Impacto al clic** | Al seleccionar un recurso se resaltan sus dependientes y se atenúa el resto. |
| **Módulos como contenedores** | Cada módulo se dibuja como un grupo con sus recursos dentro; si la llamada usa `count`/`for_each`, el grupo muestra `×N`. |
| **Cero instalación (modo demo)** | El sitio público funciona solo, con un ejemplo incrustado. |
| **Arquitectura escalable** | Parser por estructura, no por tipo de recurso; funciona con cualquier recurso o provider. |

**Frase para la presentación:** "Acepta planes JSON de Terraform, de solo lectura, con módulos anidados e instancias de `count`/`for_each`."

---

## 4. Alcance

### Dentro del MVP
- Cargar un archivo JSON (arrastrar y soltar).
- Extraer recursos, módulos y dependencias.
- Visualizar nodos y conexiones con colores por acción.
- Consultar detalles de cada recurso.
- Mostrar errores de entrada de forma comprensible.
- Incluir un ejemplo de infraestructura (con un módulo) para probarlo.
- Modo demo sin backend.

### Fuera de alcance
Ejecutar Terraform, conectarse a AWS, analizar costos, detectar vulnerabilidades, importar HCL (`.tf`), importar `.tfstate`, autenticación, múltiples providers como objetivo de pruebas y edición del diagrama.

---

## 5. Stack tecnológico

| Capa | Tecnología | Nota |
|---|---|---|
| Backend | Java 21, **Javalin**, Jackson, Maven (`mvnw`) | Javalin por curva baja; el parser es Java puro y migrable a Spring Boot. |
| Tests backend | JUnit 5 | Un test por extractor y por fixture. |
| Frontend | React, **TypeScript**, Vite | `strict` desactivado al inicio; tipar `Node`, `Edge`, `ApiError`. |
| Grafo | React Flow + **elkjs** | Plan B: nodos padre de React Flow con dagre. |
| Tests frontend | Vitest | Sin configuración extra con Vite. |
| Contenedor | Docker (solo backend) | `docker compose up --build`; puerto configurable con `PORT`. |
| CI | GitHub Actions | Build y tests de ambos lados, badge en el README. |
| Deploy | Vercel o GitHub Pages | Solo frontend. |
| Datos de prueba | Terraform CLI | `plan` sin `apply`. |
| Entrega | OBS o ScreenToGif | Video de respaldo y GIF. |

**Base de datos:** ninguna. El backend es *stateless*: procesa en memoria y descarta.

**Costo:** prácticamente $0. `terraform plan` no crea recursos. No ejecutes `apply`; si lo haces, ejecuta `terraform destroy` al terminar.

---

## 6. Arquitectura

### Principios
1. El **parser es Java puro**, sin dependencia del framework web. Javalin solo expone el endpoint.
2. El parser trabaja por **estructura del JSON**, nunca por tipo o nombre de recurso.
3. **Un solo `GraphExtractor` al inicio**, con métodos separados para nodos, aristas y módulos. Se parte en clases cuando crezca.
4. **Metadatos por tipo** (categoría, ícono) diferidos: los colores por acción no dependen de ellos. Cuando se agreguen, irán en un archivo de config con valor por defecto para tipos desconocidos.
5. El modelo `{schemaVersion, nodes, edges, modules, warnings}` es el **único contrato** entre capas.
6. El frontend solo conoce el modelo, nunca el formato del plan.

### Modelo de salida

```json
{
  "schemaVersion": 2,
  "nodes": [
    {
      "id": "module.red.aws_subnet.a",
      "type": "aws_subnet",
      "name": "a",
      "module": "module.red",
      "action": "create",
      "instances": [
        {
          "address": "module.red.aws_subnet.a[0]",
          "action": "create",
          "values": { "cidr_block": "10.0.1.0/24" },
          "unknown": ["arn", "id"],
          "sensitive": []
        }
      ],
      "unresolved": []
    }
  ],
  "edges": [
    { "from": "module.red.aws_vpc.main", "to": "module.red.aws_subnet.a" }
  ],
  "modules": [
    { "id": "module.red", "parent": null, "instances": 1 }
  ],
  "warnings": []
}
```

- `id` y `module`: dirección **sin claves de índice**; las instancias de `count`/`for_each` comparten bloque.
- `action` del bloque: `create`, `update`, `delete`, `replace`, `no-op` o `mixed` si las instancias difieren.
- `instances`: una entrada por instancia con `address` (con claves), `action`, `values`, `unknown` y `sensitive`.
- `values`: `change.after`, o `change.before` si es delete, **sin los atributos sensibles**.
- `unknown` / `sensitive`: nombres de primer nivel marcados en `after_unknown` / `after_sensitive`.
- `unresolved`: referencias `local.*` y `data.*` normalizadas a dos segmentos, solo las del propio bloque.
- `modules[].instances`: número de `module_address` distintos de esa llamada (incluye `count`/`for_each`).
- Dirección de arista: **dependencia → dependiente**, siempre entre ids de bloque.

### Qué analiza del plan JSON

| Sección | Qué extrae | Para qué |
|---|---|---|
| `format_version` | Versión del formato | Validar y advertir si es mayor a la probada |
| `resource_changes[]` | `address`, `type`, `name`, `mode`, `module_address`, `change.actions`, `change.before`, `change.after`, `change.after_unknown`, `change.after_sensitive` | **Bloques e instancias**, colores, módulos y panel de detalles |
| `configuration.root_module.resources[]` | `expressions` (`references`), `depends_on` | **Aristas** |
| `configuration.root_module.module_calls` | `expressions`, `module` (recursos y `outputs`) | **Aristas entre módulos** |

**Se ignoran:** `planned_values`, `prior_state`, `variables`, `output_changes`, `checks`, `timestamp`. Se descartan los recursos con `mode: "data"` (sus referencias sí se marcan como no trazables).

### Reglas de extracción
- **Minificado no importa:** Jackson lee el JSON como árbol (`JsonNode`). Para leerlo tú, usa `jq . plan.json`.
- **Referencias:** busca recursivamente todos los arreglos `references` (los bloques anidados los esconden a distintos niveles).
- **Agrupación por bloque:** `stripKeys` elimina `[0]` y `["a"]` para que todas las instancias de `count`/`for_each` caigan en el mismo nodo. Respeta comillas, escapes y puntos dentro de la clave (`["a.b"]`).
- **No trazables:** `local.*` y `data.*` no generan aristas; se normalizan a dos segmentos y se guardan en `unresolved` para marcarlas en el panel. `var.*` se resuelve con las entradas del módulo; `path`, `each`, `count`, `self` y `terraform` se ignoran.
- **Módulos:** las referencias dentro de un módulo son relativas; anteponer el prefijo (`module.red.`).
- **Dirección como cadena opaca:** no partirla con regex frágiles (el `for_each` puede traer puntos o corchetes).

---

## 7. Flujo de funcionamiento

1. Generas el plan:
   ```bash
   terraform plan -out plan.tfplan
   terraform show -json plan.tfplan > plan.json
   ```
2. Arrastras `plan.json` al navegador (o pulsas "Probar con ejemplo").
3. **Modo demo:** se carga el modelo incrustado (sin petición ni spinner). **Modo backend:** `POST /parse`.
4. El backend valida, extrae nodos, aristas y módulos, y responde `{schemaVersion, nodes, edges, modules, warnings}`.
5. Si algo falla, responde `{code, message}` y la UI muestra un banner.
6. elkjs calcula el layout y React Flow dibuja el grafo con módulos como contenedores y colores por acción.
7. Clic en un nodo: se abre el panel de detalles y se resaltan sus dependientes (BFS hacia adelante). Clic en el fondo limpia la selección.

### Ejecución local

```bash
# Backend con Java 21
cd backend && mvn package && java -jar target/claritytf-backend.jar

# O con Docker (backend en el puerto de PORT, 8080 por defecto)
docker compose up --build
```

El puerto se toma de la variable `PORT` (default `8080`). `GET /health` responde `{"status":"ok"}` para comprobaciones de salud.

### Interacciones

| Acción | Resultado |
|---|---|
| Clic en nodo | Panel de detalles + resaltado de dependientes |
| Clic en fondo | Limpia la selección |
| Rueda / arrastre | Zoom y desplazamiento |
| Mover nodos | Reorganiza el diagrama (solo visual) |
| Cargar otro archivo | Reemplaza el grafo |

---

## 8. Manejo de errores

Contrato de respuesta: `{ "code": "NOT_A_PLAN", "message": "detalle técnico" }`. El `code` es estable y el frontend decide el texto; el `message` técnico no se muestra tal cual.

| Código | HTTP | Cuándo | Mensaje en la UI |
|---|---|---|---|
| `NO_FILE` | 400 | Petición sin archivo | "Selecciona un archivo para continuar." |
| `FILE_TOO_LARGE` | 413 | Pasa de 5 MB | "El archivo es demasiado grande (máx. 5 MB)." |
| `INVALID_JSON` | 400 | Jackson no puede parsearlo | "El archivo no es un JSON válido." |
| `NOT_A_PLAN` | 422 | Falta `resource_changes` o `configuration` | "No parece un plan de Terraform. Genéralo con `terraform show -json plan.tfplan`." |
| `EMPTY_PLAN` | 422 | `resource_changes` vacío | "El plan no contiene recursos." |
| `INTERNAL_ERROR` | 500 | Excepción inesperada | "Ocurrió un error al procesar el archivo." |
| `WRONG_EXTENSION` | (frontend) | No es `.json` | "Sube un archivo .json." |
| `BACKEND_UNREACHABLE` | (frontend) | Falla el `fetch` | "No se pudo conectar al backend local. Prueba el modo demo." |

**En la UI:**
- Banner rojo arriba de la zona de carga, con botón de cerrar. Sin `alert()` ni modales.
- Conserva el grafo anterior si ya había uno.
- En `BACKEND_UNREACHABLE` y `NOT_A_PLAN`, ofrece "Probar con ejemplo" o "Usar modo demo".
- Nunca muestres trazas ni el mensaje crudo del backend.
- El spinner aparece solo en modo backend.

---

## 9. Robustez del parser

- Usar `path()` y `at()` de Jackson, nunca `get()` (evita `NullPointerException`).
- Validar el **tipo** de cada campo, no solo su presencia (`isArray()`, `isObject()`).
- **Saltar lo inválido sin abortar:** un recurso sin `address` o sin `actions` se omite y se agrega a `warnings`.
- **Filtrar aristas hacia elementos inexistentes:** construir primero el conjunto de ids; crear la arista solo si ambos extremos existen. Eliminar duplicados y autoreferencias.
- Tolerar **tipos desconocidos** con estilo por defecto.
- Manejar `change.after == null` (delete) y `actions` con dos elementos (replace).
- Registrar advertencia si `format_version` es mayor a la probada.
- Advertir si el plan trae `complete: false` (plan parcial, p. ej. `-target`) o `errored: true`; los campos ausentes son neutros.
- Manejador general de excepciones en `App.java` (`app.exception`) que devuelve `INTERNAL_ERROR` sin exponer detalles.
- **No registrar en logs** el contenido del plan.

---

## 10. Estructura del proyecto

```
claritytf/
├── backend/
│   ├── pom.xml
│   ├── Dockerfile                       
│   └── src/
│       ├── main/java/claritytf/
│       │   ├── App.java                 Javalin: rutas /parse y /health, CORS, límite de tamaño y errores (único archivo con framework)
│       │   ├── PlanParser.java          Valida el plan y orquesta (Java puro)
│       │   ├── GraphExtractor.java      Nodos, aristas y módulos (Java puro)
│       │   ├── Model.java               Records: Instance, Node, Edge, ModuleRef, GraphModel
│       │   └── PlanException.java       Código de error + mensaje
│       └── test/
│           ├── java/claritytf/
│           │   ├── PlanParserTest.java  Recorre todos los fixtures
│           │   ├── AppTest.java         Contrato HTTP contra App.create()
│           │   └── TestAssertions.java  Invariantes del grafo
│           └── resources/fixtures/      Planes de prueba (válidos y rotos)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                      Carga, llamada a /parse, banner de errores, leyenda y layout general
│       ├── types.ts                     Instance, Node, Edge, ModuleRef, GraphModel, ApiError
│       ├── Graph.tsx                    React Flow: nodos de recurso y contenedores de módulo
│       ├── DetailsPanel.tsx             Panel de detalles: instancias, unknown/sensitive, unresolved
│       ├── details.ts                   Separa valores conocidos, null y arrays vacíos
│       ├── layout.ts                    Layout con elkjs (plan B: dagre)
│       ├── useImpact.ts                 BFS para resaltar dependientes
│       ├── demoModel.json               Modelo incrustado v2 (modo demo)
│       ├── demos/                       Demo sintética v2 (bloques ×N y acción mixed)
│       └── __tests__/                   Vitest
├── examples/
│   ├── terraform/                       Código del ejemplo (con un módulo)
│   ├── plan.json                        Plan sanitizado
│   └── errors/                          JSON roto, no-plan, plan vacío, .txt
├── .github/workflows/ci.yml             Build y tests de ambos lados
├── docker-compose.yml                   Backend con el puerto de PORT
├── README.md
├── LICENSE
└── .gitignore                           target/, node_modules/, .env, *.tfstate, *.tfplan
```

**Reglas que sí se mantienen (garantizan la escalabilidad)**
- `PlanParser` y `GraphExtractor` **no importan nada de Javalin**; `App.java` es lo único que habla HTTP.
- El frontend solo conoce `types.ts` (el modelo), nunca el formato del plan.

**Qué se junta (sigue existiendo, en menos archivos)**
- Validación, extracción de nodos, aristas y módulos, y normalización de referencias: dentro de `PlanParser` y `GraphExtractor`.
- Manejo de rutas y de errores: dentro de `App.java`.
- Zona de carga, banner de errores y leyenda: dentro de `App.tsx`.
- Nodo de recurso y contenedor de módulo: dentro de `Graph.tsx`.

**Qué se difiere (fuera del MVP actual)**
- Metadatos por tipo de recurso (`typeMeta`): categoría e ícono.
- Separar el backend en `core/` y `api/`.
- Un test por extractor (por ahora, un solo test recorre todos los fixtures).

**Cuándo dividir:** cuando `GraphExtractor` pase de ~300 líneas o cuando agregues otro formato de entrada. Se parte en extractores de nodos, aristas y módulos (más un normalizador de referencias). Es un refactor de minutos.

---

## 11. Qué muestra y qué no

**Cada flecha es una dependencia declarada en el código.** Sale de `references`, `depends_on`, variables de módulo, outputs y `depends_on` de `module_calls`. No hay heurísticas por nombre ni por tipo de recurso. La dirección es dependencia → dependiente.

**Las instancias se agrupan en su bloque.** `count` y `for_each` no crean un nodo por instancia: el nodo es el bloque de configuración (`aws_subnet.a`), con insignia `×N` y la lista de instancias (dirección y acción) en el panel. La acción del bloque es la común, o `mixed` (`◆`) si difieren.

**Lo no trazable se marca, no se omite.** Las referencias `local.*` y `data.*` que el plan no permite resolver aparecen en “Dependencias no trazables”, con la nota de que Terraform las declara pero el plan no permite trazarlas. Los atributos que solo se conocerán al aplicar y los sensibles se listan por nombre; los `null` se agrupan en “N sin valor”.

**Los valores sensibles se ocultan.** Se eliminan de `values` antes de enviarlos y solo se listan sus nombres. El backend no guarda ni registra el plan.

**Las dependencias por ID escrito a mano no se pueden detectar.** Si un recurso apunta a otro con un ID literal (`subnet_id = "subnet-123"`), no hay expresión que seguir y Terraform tampoco conoce esa relación. La app no la inventa.

### Límites del alcance
- Solo plan JSON. No lee `.tf`, `.tfstate` ni el state JSON.
- Solo lectura: no edita el diagrama ni genera Terraform (solo mover nodos).
- Sin conexión a AWS, costos, vulnerabilidades ni autenticación.

### De los módulos
- La demo usa un nivel de anidación; el parser soporta más.
- El `depends_on` entre módulos sí genera aristas: un módulo completo en el `depends_on` de un recurso o de una llamada expande a todos sus recursos (anidados incluidos). Una referencia `module.x` suelta dentro de una expresión no se expande; solo las salidas concretas (`module.x.output`) crean aristas.

### De la arquitectura
- El backend es solo local: el sitio público muestra únicamente el ejemplo (modo demo).
- TypeScript no valida datos en ejecución; lo cubren `schemaVersion` y los tests del backend.
- Sin base de datos ni historial.
- Código agrupado en pocos archivos: se divide al crecer, sin perder la separación parser/framework.

### Del plan JSON
- Valores anidados enormes (políticas IAM, `user_data`) se truncan en el panel.
- Planes grandes se cargan, pero el grafo se vuelve ilegible: tope de 5 MB y aviso.
- Planes sin cambios devuelven `EMPTY_PLAN`.
- Un plan parcial (`complete: false`) o con errores (`errored: true`) se muestra, pero con una advertencia.

**Cómo decirlo en clase:** "Probado con recursos de red, cómputo y almacenamiento", no "todos los de AWS".

---

## 12. Plan de trabajo

### Datos y modelo
- [ ] Crear el repo, la estructura de carpetas, `.gitignore` y `LICENSE` (MIT).
- [ ] Escribir el ejemplo de Terraform con **un módulo** (`red`: VPC y subnet; EC2 fuera del módulo).
- [ ] Generar `plan.json` con acciones create, update y delete.
- [ ] Generar un segundo plan con otro tipo de recursos (S3 o IAM) para pruebas.
- [ ] Definir el modelo `{schemaVersion, nodes, edges, modules, warnings}` y sus tipos en `types.ts`.
- [ ] Repaso de lo básico de TypeScript (media tarde).

### Backend, nodos y pruebas
- [ ] Proyecto Maven con Javalin, Jackson y JUnit 5.
- [ ] `PlanParser` (validación) y `GraphExtractor` con los nodos (agrupando por `module_address`).
- [ ] `PlanException` (código + mensaje) y manejo de errores en `App.java`.
- [ ] Endpoint `POST /parse` con CORS y límite de 5 MB.
- [ ] 6-8 fixtures: plan válido, con módulos, con `count`, con `for_each`, solo-delete, sin `configuration`, tipo desconocido, JSON roto.
- [ ] Un test por fixture.

### Aristas y grafo básico (punto de control)
- [ ] En `GraphExtractor`: normalización de referencias, aristas y módulos (recursivo).
- [ ] Filtro de aristas inexistentes, duplicados y autoreferencias.
- [ ] Frontend: Vite + React + TypeScript, zona de carga y llamada a `/parse` dentro de `App.tsx`.
- [ ] Grafo básico con React Flow y colores por acción.
- [ ] **Punto de control:** si al final del día no hay grafo con colores, recortar el panel de detalles, no el impacto al clic.

### Lo que diferencia
- [ ] Contenedores de módulo con elkjs (`layout.ts` y nodo de módulo dentro de `Graph.tsx`).
- [ ] Impacto al clic (`useImpact.ts`, BFS) con atenuado del resto.
- [ ] Panel de detalles con acción como etiqueta, tipo, nombre y `values` como pares clave-valor.
- [ ] Leyenda y botón "Cargar otro archivo" (dentro de `App.tsx`).

### Errores, demo y entrega técnica
- [ ] Banner de errores (en `App.tsx`) con todos los códigos y acciones sugeridas.
- [ ] Spinner solo en modo backend.
- [ ] Modo demo con `demoModel.json` incrustado.
- [ ] Probar los 4 archivos de `examples/errors/`.
- [ ] `Dockerfile` del backend y `ci.yml` de GitHub Actions.
- [ ] Si sobra tiempo: filtro por tipo y buscador.
- [ ] Si sobra tiempo: dividir `GraphExtractor`, separar `core/` y `api/` y agregar `typeMeta`.

### Deploy y presentación
- [ ] Deploy del frontend en Vercel o GitHub Pages.
- [ ] Video de respaldo (plan B) y GIF para LinkedIn.
- [ ] README final: formato de entrada, arquitectura, limitaciones y GIF.
- [ ] QR al sitio para que el público lo pruebe en vivo.
- [ ] Ensayo de la demo.

### Planes B
| Riesgo | Alternativa |
|---|---|
| Aristas entre módulos fallan | Conectar a nivel de grupo con las `expressions` de `module_calls` |
| elkjs no sale | Nodos padre de React Flow con posiciones calculadas por dagre |
| TypeScript frena | Usar `any` y seguir; priorizar el grafo, que es lo que se vota |
| Falla internet o backend en clase | Video de respaldo |
| Se acaba el tiempo | Recortar filtros y buscador; **nunca** el modo demo ni el impacto al clic |

---

## 13. Calidad y pruebas

- **Backend:** `PlanParserTest` recorre todos los fixtures (incluido `plan-sensible.json`) y comprueba invariantes: sin colgantes, autoaristas ni duplicados, acciones válidas, instancias coherentes con su bloque y `ModuleRef.instances >= 1`. `AppTest` cubre el contrato HTTP.
- **Frontend:** Vitest para los demos v2 (bloques e instancias), el panel (`splitValues`), el layout y el BFS de `useImpact`.
- **Pruebas manuales:** al menos 2-3 planes distintos (tu VPC + EC2, uno con S3 o IAM y uno de un ejemplo público del registry de Terraform). Cada plan que falle se vuelve un fixture de regresión.
- **CI:** build y tests en cada push; badge "passing" en el README.

---

## 14. Seguridad y privacidad

- El backend no guarda nada: "tu plan no se almacena".
- No registrar el contenido del plan en logs.
- Un plan real puede traer IPs, IDs y secretos en `values`: usar planes sanitizados en el repo.
- Revisar que no haya credenciales ni IDs reales de AWS en el código ni en los ejemplos.
- Si expones el backend con un túnel (`cloudflared` o `ngrok`) para la presentación: limitar el tamaño del archivo y apagarlo al terminar.

---

## 15. Presentación (2 minutos)

| Tiempo | Contenido |
|---|---|
| 20 s | Problema: "los planes de Terraform son JSON ilegibles". |
| 90 s | Demo: abrir el sitio, mostrar el grafo del ejemplo, clic en un recurso (impacto), cargar un plan en vivo con el backend local. |
| 30 s | Cómo está hecho: parser por estructura, módulos, modelo único entre capas. |

**Para que destaque**
- Demo con participación (QR al sitio, o que alguien sugiera qué recurso inspeccionar).
- Pulido visual y una pantalla de inicio clara.
- Abrir desde Chrome (Safari puede bloquear llamadas a `localhost`).
- Video de respaldo listo.

---

## 16. Siguientes fases (no entran en el MVP)

- Dividir `GraphExtractor` en extractores por responsabilidad, separar `core/` y `api/` y agregar metadatos por tipo (`typeMeta`).
- Soporte de `.tfstate` con otro extractor.
- Más niveles de anidación de módulos.
- Parser en el navegador para que el sitio público acepte planes propios sin backend.
- Agrupar y filtrar por categoría (red, cómputo, datos, seguridad).
- Exportar a PNG.
- Historial y comparación de planes (aquí sí haría falta una base de datos).
