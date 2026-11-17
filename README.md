
# ClarityTF

> Understand your Terraform infrastructure plans through interactive dependency graphs.

[![CI](https://github.com/alextristanc/claritytf/actions/workflows/ci.yml/badge.svg)](https://github.com/alextristanc/claritytf/actions/workflows/ci.yml)
![Java](https://img.shields.io/badge/Java-21-orange)
![React](https://img.shields.io/badge/React-19-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

## Overview

ClarityTF is a web application that transforms Terraform plan JSON files into interactive infrastructure dependency graphs.

Instead of manually inspecting large JSON files, developers can visualize infrastructure changes, explore resource dependencies, inspect individual resources, and understand the potential impact of infrastructure modifications.

The application uses a Java backend to parse Terraform plans and generate a simplified graph model, while a React frontend renders the infrastructure as an interactive diagram.

**Key highlights:**
- Interactive infrastructure visualization.
- Resource grouping and nested module support.
- Dependency tracking and impact analysis.
- Resource action indicators.
- Sensitive attribute filtering.
- Built-in examples that work without a backend.

## Features

### Infrastructure visualization

- Interactive dependency graphs.
- Automatic graph layout using ELK.js.
- Resource grouping by Terraform modules.
- Nested module visualization.
- Resource instances grouped by configuration block (`count` and `for_each`).

### Change visualization

Resources are visually distinguished according to their planned actions.

| Action | Description |
|---|---|
| Create | New resource |
| Update | Modified resource |
| Delete | Resource scheduled for deletion |
| Replace | Resource scheduled for replacement |
| No-op | Resource without changes |
| Mixed | Instances within the same block have different actions |

### Dependency analysis

- Visualize declared dependencies between resources.
- Highlight direct and indirect dependents.
- Identify resources potentially affected by infrastructure changes.
- Display dependencies that cannot be traced from the plan.

### Resource inspection

Selecting a resource opens a details panel containing:

- Resource type and address.
- Planned action.
- Module information.
- Individual resource instances.
- Known attribute values.
- Attributes that will only be known after applying.
- Sensitive attribute names, with their values excluded.
- Unresolved dependencies.

### Demo mode

ClarityTF includes built-in examples that allow users to explore the application without installing Terraform or starting the backend.

Available examples:

- **Modules and mixed changes:** demonstrates modules, resource dependencies, and different actions across instances.
- **Basic:** demonstrates a simpler infrastructure graph.

## Demo

The repository includes a frontend deployment workflow for GitHub Pages.

The deployment workflow is triggered manually through GitHub Actions (`workflow_dispatch`).

To publish the application, execute the **Deploy** workflow from the Actions tab.

## Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Backend | Java 21 | Terraform plan processing |
| HTTP framework | Javalin 6 | REST API |
| JSON processing | Jackson 2 | JSON parsing |
| Backend build | Maven | Dependency management and packaging |
| Backend testing | JUnit 5 | Parser and API tests |
| Frontend | React 19 | User interface |
| Language | TypeScript 6 | Frontend development |
| Build tool | Vite 8 | Development server and production builds |
| Graph visualization | @xyflow/react | Interactive dependency graph |
| Graph layout | ELK.js | Automatic graph positioning |
| Frontend testing | Vitest | Automated frontend tests |
| Code quality | ESLint | Static code analysis |
| Containerization | Docker | Backend container |
| CI/CD | GitHub Actions | Automated testing and deployment |

**Database:** None. The backend processes plans in memory without persistent storage.

## Architecture

ClarityTF follows a two-component architecture.

### Backend

The backend is responsible for:

- Receiving Terraform plan JSON.
- Validating the input structure.
- Extracting resources and their instances.
- Identifying resource dependencies.
- Extracting module relationships.
- Filtering sensitive attribute values.
- Generating a simplified graph model.

The parser is implemented independently of the HTTP framework.

### Frontend

The frontend is responsible for:

- Loading built-in examples.
- Uploading Terraform plan JSON files.
- Communicating with the backend.
- Rendering resources and dependencies.
- Calculating graph layouts.
- Displaying resource details.
- Performing dependency impact analysis.

### Architecture diagram

```text
       Terraform Plan JSON
                |
                v
       +------------------+
       |   Java Backend   |
       |                  |
       |   Javalin        |
       |   Jackson        |
       |   PlanParser     |
       |   GraphExtractor |
       +------------------+
                |
                v
       Simplified Graph Model
       ----------------------
       schemaVersion
       nodes
       edges
       modules
       warnings
                |
                v
       +------------------+
       |  React Frontend  |
       |                  |
       |  TypeScript      |
       |  React Flow      |
       |  ELK.js          |
       +------------------+
                |
                v
       Interactive Infrastructure
              Diagram
```

### Data flow

1. Terraform generates an infrastructure plan.
2. The plan is exported to JSON.
3. The user uploads the JSON file.
4. The Java backend validates and processes the plan.
5. The backend returns a normalized graph model.
6. The frontend calculates the graph layout.
7. React Flow renders the infrastructure.
8. Users can inspect resources and analyze their dependencies.

The frontend consumes the normalized graph model rather than the original Terraform plan structure.

## Terraform Plan Format

ClarityTF accepts JSON plans generated using Terraform CLI.

Generate a plan:

```bash
terraform plan -out plan.tfplan
```

Export it to JSON:

```bash
terraform show -json plan.tfplan > plan.json
```

Upload `plan.json` to ClarityTF.

The application does not execute Terraform commands or apply infrastructure changes.

### Graph Model

The backend returns a simplified JSON structure:

```json
{
  "schemaVersion": 2,
  "nodes": [],
  "edges": [],
  "modules": [],
  "warnings": []
}
```

| Property | Description |
|---|---|
| `schemaVersion` | Graph model version |
| `nodes` | Resource blocks and their instances |
| `edges` | Dependencies between resources |
| `modules` | Module hierarchy and instance counts |
| `warnings` | Parsing and plan warnings |

### Dependency direction

Edges follow this convention:

**Dependency → Dependent resource**

For example:

```text
VPC → Subnet → EC2 Instance
```

Selecting a resource highlights its direct and indirect dependents using breadth-first search (BFS).

### Resource grouping

Terraform resources using `count` or `for_each` are grouped into a single graph node.

Individual instances remain available in the details panel.

The block action is aggregated from its instances. If their actions differ, the block is marked as `mixed`.

### Sensitive attributes

Attributes identified as sensitive by Terraform are excluded from the values sent to the frontend.

Their names remain available for inspection.

## Installation and Setup

### Prerequisites

For local development:

- Java Development Kit (JDK) 21.
- Maven.
- Node.js 22 or compatible.
- npm.
- Git.

Terraform CLI is only required when generating your own infrastructure plans.

Docker and Docker Compose are optional.

### 1. Clone the repository

```bash
git clone https://github.com/alextristanc/claritytf.git

cd claritytf
```

### 2. Start the backend

Navigate to the backend directory:

```bash
cd backend
```

Build the application:

```bash
mvn -q compile exec:java
```

Run the generated JAR:

```bash
java -jar target/claritytf-backend.jar
```

The backend starts on port `8080` by default.

### 3. Start the frontend

Open another terminal and navigate to the frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Open the local URL provided by Vite.

### 4. Run with Docker

Alternatively, start the backend using Docker Compose from the repository root:

```bash
docker compose up --build
```

The backend will be available on port `8080` by default.

To change the port:

```bash
PORT=9090 docker compose up --build
```

## Usage

### Demo mode

1. Open ClarityTF.
2. Select an example from the example selector.
3. Explore the infrastructure graph.
4. Select a resource to inspect its details.
5. Explore its dependencies and dependents.

Demo mode works without the Java backend.

### Backend mode

1. Start the Java backend.
2. Open the frontend.
3. Generate a Terraform plan JSON file.
4. Drag and drop the file into the application or use the upload button.
5. Wait for the backend to process the plan.
6. Explore the resulting graph.

### Graph interactions

| Interaction | Result |
|---|---|
| Click a resource | Opens its details panel |
| Click the background | Clears the selection |
| Mouse wheel | Zooms in or out |
| Drag the canvas | Moves around the graph |
| Drag a resource node | Changes its visual position |
| Select another file | Replaces the current graph |
| Select a demo | Loads a built-in example |

## API Reference

The Java backend exposes two HTTP endpoints.

### `GET /health`

Checks whether the backend is running.

Example response:

```json
{
  "status": "ok"
}
```

### `POST /parse`

Receives a Terraform plan JSON file as the raw request body.

Example:

```bash
curl -X POST http://localhost:8080/parse \
  -H "Content-Type: application/json" \
  --data-binary @examples/plan.json
```

Successful responses return the graph model:

```json
{
  "schemaVersion": 2,
  "nodes": [],
  "edges": [],
  "modules": [],
  "warnings": []
}
```

### Error responses

The backend uses structured error responses:

```json
{
  "code": "INVALID_JSON",
  "message": "JSON mal formado"
}
```

| Error code | HTTP status | Description |
|---|---:|---|
| `NO_FILE` | 400 | Empty request body |
| `INVALID_JSON` | 400 | Invalid JSON structure |
| `FILE_TOO_LARGE` | 413 | Request exceeds the size limit |
| `NOT_A_PLAN` | 422 | Input is not a valid Terraform plan |
| `EMPTY_PLAN` | 422 | No representable resource changes |
| `INTERNAL_ERROR` | 500 | Unexpected backend error |

The frontend also handles:

- `WRONG_EXTENSION`: uploaded file is not a `.json` file.
- `BACKEND_UNREACHABLE`: backend cannot be reached.

## Project Structure

```text
claritytf/
│
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── deploy.yml
│
├── backend/
│   ├── Dockerfile
│   ├── pom.xml
│   └── src/
│       ├── main/java/claritytf/
│       │   ├── App.java
│       │   ├── PlanParser.java
│       │   ├── GraphExtractor.java
│       │   ├── Model.java
│       │   └── PlanException.java
│       │
│       └── test/
│           ├── java/claritytf/
│           │   ├── AppTest.java
│           │   ├── PlanParserTest.java
│           │   └── TestAssertions.java
│           │
│           └── resources/fixtures/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── __tests__/
│   │   ├── demos/
│   │   ├── App.tsx
│   │   ├── Graph.tsx
│   │   ├── DetailsPanel.tsx
│   │   ├── types.ts
│   │   ├── layout.ts
│   │   ├── details.ts
│   │   ├── theme.ts
│   │   ├── useImpact.ts
│   │   └── demoModel.json
│   │
│   ├── package.json
│   ├── package-lock.json
│   └── vite.config.ts
│
├── examples/
│   ├── errors/
│   ├── terraform/
│   ├── terraform-cambios/
│   ├── terraform-dependencias/
│   ├── terraform-modulos/
│   ├── plan.json
│   ├── plan-cambios.json
│   ├── plan-dependencias.json
│   └── plan-modulos.json
│
├── docker-compose.yml
├── LICENSE
├── README.md
└── .gitignore
```

## Testing

ClarityTF includes automated tests for both the backend and frontend.

### Backend tests

The backend uses JUnit 5.

Run tests:

```bash
cd backend
mvn test
```

Tests cover:

- Terraform plan parsing.
- Resource extraction.
- Dependency extraction.
- Module handling.
- Sensitive attribute filtering.
- HTTP endpoint behavior.
- Error handling.
- Graph model consistency.

Test fixtures are located in:

```text
backend/src/test/resources/fixtures/
```

### Frontend tests

The frontend uses Vitest.

Run tests:

```bash
cd frontend
npm test
```

The tests cover:

- Built-in demo model validation.
- Resource and module relationships.
- Graph layout.
- Resource detail value processing.
- Dependency impact calculation.

### Code quality

Run ESLint:

```bash
npm run lint
```

Build the production frontend:

```bash
npm run build
```

### Continuous Integration

GitHub Actions automatically executes the following checks on pushes and pull requests:

**Backend**
- Java 21 setup.
- Maven dependency caching.
- JUnit tests.

**Frontend**
- Node.js 22 setup.
- Dependency installation.
- ESLint.
- Vitest.
- Production build.

## Scope and Limitations

ClarityTF focuses on visualizing Terraform plan JSON files.

The following capabilities are outside the current scope:

- Executing Terraform commands.
- Applying infrastructure changes.
- Editing Terraform configuration files.
- Direct `.tf` or `.tfstate` file parsing.
- Connecting to AWS or other cloud providers.
- Infrastructure cost estimation.
- Security and vulnerability scanning.
- User authentication.
- Persistent infrastructure history.
- Plan comparison.

### Dependency limitations

ClarityTF extracts relationships declared through Terraform configuration references and dependency declarations.

It does not infer relationships based on resource names or literal IDs.

For example, if a resource references another resource using a manually written ID string, that relationship might not be represented in the graph.

### Input limitations

- Maximum request size: 5 MB.
- Input must be a Terraform plan JSON.
- Plans without representable resource changes are rejected.
- Large attribute values are truncated in the details panel.
- Partial plans and plans containing errors may be displayed with warnings.

### Deployment architecture

The public frontend uses built-in examples.

The Java backend is designed to run locally during development and demonstrations. The public frontend does not automatically provide a remotely hosted backend.

## Security and Privacy

- Terraform plans are processed in memory.
- The backend does not persist uploaded plans.
- Sensitive attributes identified by Terraform are excluded from the graph model's values.
- Uploaded infrastructure files should not be committed to public repositories unless sanitized.
- Avoid exposing real infrastructure identifiers, credentials, or sensitive configuration values.

**Important:** The backend is intended for local development and demonstration, not unrestricted public exposure.

## Roadmap

- [x] Terraform plan JSON parsing.
- [x] Resource extraction and grouping.
- [x] Dependency graph generation.
- [x] Module hierarchy visualization.
- [x] Resource action indicators.
- [x] Interactive graph rendering.
- [x] Dependency impact analysis.
- [x] Resource details panel.
- [x] Sensitive attribute filtering.
- [x] Built-in demo examples.
- [x] Backend error handling.
- [x] Backend and frontend automated tests.
- [x] GitHub Actions CI workflow.
- [x] Docker support for the backend.
- [x] GitHub Pages deployment workflow.

### Potential future improvements

- [ ] Infrastructure plan comparison.
- [ ] Graph export to PNG or SVG.
- [ ] Resource filtering and search.
- [ ] Additional visualization options.
- [ ] Support for Terraform state files.
- [ ] Improved handling of large infrastructure plans.

## Contributing

Contributions, suggestions, and bug reports are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Implement your changes.
4. Add or update automated tests.
5. Submit a pull request describing your changes.

## License

This project is licensed under the MIT License.

See the [LICENSE](LICENSE) file for details.

## Author

**David Alejandro Tristán Contreras**

- GitHub: [@alextristanc](https://github.com/alextristanc)
- Portfolio: [alextristanc.github.io](https://alextristanc.github.io/)
