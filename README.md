# ClarityTF

> Arrastra tu plan de Terraform y ve, en 5 segundos, qué se crea, qué se rompe y qué depende de qué.

---

## 1. Descripción

Aplicación web que recibe el **plan JSON de Terraform** (`terraform show -json plan.tfplan`), identifica recursos, módulos y dependencias, y muestra un **diagrama interactivo** en el navegador.

Un backend Java procesa el JSON y devuelve un modelo simplificado `{schemaVersion, nodes, edges}`. El frontend dibuja ese modelo. Solo el frontend se despliega públicamente; el backend corre local durante la demostración.

**Contexto del proyecto:** presentación en clase (con votación al proyecto más votado) y publicación en LinkedIn. 

## 2. En qué ayuda

- Ver de un vistazo **qué va a crear, actualizar o borrar** un plan.
- Ver **qué depende de qué**, y qué se afecta si cambias o borras un recurso.
- Entender la estructura de infraestructura con **módulos** sin leer el JSON.
- Consultar los detalles de cada recurso en un panel lateral.
- Probarlo **sin instalar nada** en modo demo (a diferencia de `terraform graph`, que exige Graphviz y entrega una imagen estática).

## 3. Qué lo diferencia

| Función | Valor |
|---|---|
| **Colores por acción** | Verde = create, amarillo = update, rojo = delete, azul = sin cambios (replace = delete + create). |
| **Impacto al clic** | Al seleccionar un recurso se resaltan sus dependientes y se atenúa el resto. |
| **Módulos como contenedores** | Cada módulo se dibuja como un grupo con sus recursos dentro. |
| **Cero instalación (modo demo)** | El sitio público funciona solo, con un ejemplo incrustado. |
| **Arquitectura escalable** | Parser por estructura, no por tipo de recurso; funciona con cualquier recurso o provider. |

**Frase para la presentación:** "Acepta planes JSON de Terraform, de solo lectura, con módulos de un nivel."

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
| Contenedor | Docker (solo backend) | Levantar con dos comandos. |
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
5. El modelo `{schemaVersion, nodes, edges}` es el **único contrato** entre capas.
6. El frontend solo conoce el modelo, nunca el formato del plan.

### Modelo de salida

```json
{
  "schemaVersion": 1,
  "nodes": [
    {
      "id": "module.red.aws_vpc.main",
      "type": "aws_vpc",
      "name": "main",
      "module": "module.red",
      "action": "create",
      "values": {}
    }
  ],
  "edges": [
    { "from": "module.red.aws_vpc.main", "to": "module.red.aws_subnet.a" }
  ],
  "modules": [
    { "id": "module.red", "parent": null }
  ],
  "warnings": []
}
```

- `action`: `create`, `update`, `delete`, `replace` o `no-op`.
- Dirección de arista: **dependencia → dependiente**.
- `values`: `change.after`, o `change.before` si es delete.

### Qué analiza del plan JSON

| Sección | Qué extrae | Para qué |
|---|---|---|
| `format_version` | Versión del formato | Validar y advertir si es mayor a la probada |
| `resource_changes[]` | `address`, `type`, `name`, `mode`, `module_address`, `change.actions`, `change.before`, `change.after` | **Nodos**, colores, módulos y panel de detalles |
| `configuration.root_module.resources[]` | `expressions` (`references`), `depends_on` | **Aristas** |
| `configuration.root_module.module_calls` | `expressions`, `module` (recursos y `outputs`) | **Aristas entre módulos** |

**Se ignoran:** `planned_values`, `prior_state`, `variables`, `output_changes`, `checks`, `timestamp`. Se descartan los recursos con `mode: "data"`.

### Reglas de extracción
- **Minificado no importa:** Jackson lee el JSON como árbol (`JsonNode`). Para leerlo tú, usa `jq . plan.json`.
- **Referencias:** busca recursivamente todos los arreglos `references` (los bloques anidados los esconden a distintos niveles).
- **Normalización:** `aws_vpc.main.id` y `aws_vpc.main` son el mismo recurso; quédate con `tipo.nombre`. Quita índices (`[0]`, `["a"]`) para emparejar `resource_changes` con `configuration` cuando hay `count` o `for_each`.
- **Descartar** referencias que empiecen con `var.`, `local.`, `data.`.
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
4. El backend valida, extrae nodos, aristas y módulos, y responde `{schemaVersion, nodes, edges, modules}`.
5. Si algo falla, responde `{code, message}` y la UI muestra un banner.
6. elkjs calcula el layout y React Flow dibuja el grafo con módulos como contenedores y colores por acción.
7. Clic en un nodo: se abre el panel de detalles y se resaltan sus dependientes (BFS hacia adelante). Clic en el fondo limpia la selección.

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
│       │   ├── App.java                 Javalin: ruta /parse, CORS, límite de tamaño y errores (único archivo con framework)
│       │   ├── PlanParser.java          Valida el plan y orquesta (Java puro)
│       │   ├── GraphExtractor.java      Nodos, aristas y módulos (Java puro)
│       │   ├── Model.java               Records anidados: Node, Edge, GraphModel
│       │   └── PlanException.java       Código de error + mensaje
│       └── test/
│           ├── java/claritytf/
│           │   └── PlanParserTest.java  Recorre todos los fixtures
│           └── resources/fixtures/      Planes de prueba (válidos y rotos)
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                      Carga, llamada a /parse, banner de errores, leyenda y layout general
│       ├── types.ts                     Node, Edge, GraphModel, ApiError
│       ├── Graph.tsx                    React Flow: nodos de recurso y contenedores de módulo
│       ├── DetailsPanel.tsx             Panel de detalles
│       ├── layout.ts                    Layout con elkjs (plan B: dagre)
│       ├── useImpact.ts                 BFS para resaltar dependientes
│       ├── demoModel.json               Modelo incrustado (modo demo)
│       └── __tests__/                   Vitest
├── examples/
│   ├── terraform/                       Código del ejemplo (con un módulo)
│   ├── plan.json                        Plan sanitizado
│   └── errors/                          JSON roto, no-plan, plan vacío, .txt
├── .github/workflows/ci.yml             Build y tests de ambos lados
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

## 11. Limitaciones

**Del alcance**
- Solo plan JSON. No lee `.tf`, `.tfstate` ni el state JSON.
- Solo lectura: no edita el diagrama ni genera Terraform (solo mover nodos).
- Sin conexión a AWS, costos, vulnerabilidades ni autenticación.

**De los módulos**
- Un nivel de anidación garantizado en la demo.
- Si fallan las aristas entre módulos, se conectan a nivel de grupo (atajo con las `expressions` de `module_calls`).

**De la arquitectura**
- El backend es solo local: el sitio público muestra únicamente el ejemplo (modo demo).
- TypeScript no valida datos en ejecución; lo cubren `schemaVersion` y los tests del backend.
- Sin base de datos ni historial.
- Código agrupado en pocos archivos: se divide al crecer, sin perder la separación parser/framework.

**Del plan JSON**
- Los valores `known after apply` se muestran como desconocidos (vienen en `after_unknown`).
- Dependencias por ID escrito a mano o por `data` sources no generan aristas.
- Valores anidados enormes (políticas IAM, `user_data`) se truncan o se muestran colapsados.
- Planes grandes se cargan, pero el grafo se vuelve ilegible: tope de 5 MB y aviso.
- Planes sin cambios devuelven `EMPTY_PLAN`.
- Valores sensibles pueden venir redactados o en claro: no mostrarlos sin cuidado ni registrarlos.

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

- **Backend:** un test (`PlanParserTest`) que recorre todos los fixtures; se separa por extractor cuando el código se divida. Criterio clave: cero excepciones inesperadas y **cero aristas con extremos inexistentes**.
- **Frontend:** Vitest para `useImpact` (BFS) y el cliente de la API.
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
