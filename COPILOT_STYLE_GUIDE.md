# Backstage Copilot Style Guide

This guide is intended for use by GitHub Copilot and other AI coding assistants when generating or reviewing code in this repository. It extends and reinforces [`STYLE.md`](./STYLE.md) with concrete patterns drawn from the actual plugin implementations in this codebase.

---

## Table of Contents

1. [Repository Structure](#1-repository-structure)
2. [TypeScript Conventions](#2-typescript-conventions)
3. [Plugin Architecture](#3-plugin-architecture)
4. [Frontend Plugin Patterns (New System)](#4-frontend-plugin-patterns-new-system)
5. [Frontend Plugin Patterns (Legacy System)](#5-frontend-plugin-patterns-legacy-system)
6. [Backend Plugin Patterns](#6-backend-plugin-patterns)
7. [Common / Shared Package Patterns](#7-common--shared-package-patterns)
8. [React Component Patterns](#8-react-component-patterns)
9. [API Client & Utility API Patterns](#9-api-client--utility-api-patterns)
10. [Error Handling](#10-error-handling)
11. [Permissions](#11-permissions)
12. [Testing Patterns](#12-testing-patterns)
13. [Documentation Guidelines](#13-documentation-guidelines)
14. [File & Export Conventions](#14-file--export-conventions)
15. [Tooling and Commands](#15-tooling-and-commands)

---

## 1. Repository Structure

This is a Yarn workspaces monorepo. The two main code directories are:

| Directory | Purpose |
|-----------|---------|
| `/packages` | Core framework packages (prefixed `@backstage/`) |
| `/plugins` | Plugin packages (prefixed `@backstage/plugin-*`) |

**Package naming convention** — a plugin family typically consists of up to four packages:

| Suffix | Role | Example |
|--------|------|---------|
| *(none)* | Frontend plugin (new system default export) | `@backstage/plugin-example` |
| `-backend` | Backend plugin | `@backstage/plugin-example-backend` |
| `-common` | Shared types, permissions, constants | `@backstage/plugin-example-common` |
| `-react` | Shareable React components / hooks / API refs | `@backstage/plugin-example-react` |
| `-node` | Shared backend utilities | `@backstage/plugin-example-node` |
| `-backend-module-*` | Optional backend extension module | `@backstage/plugin-example-backend-module-github` |

> **Framework naming distinction:** Packages prefixed `core-` belong to the old frontend system. Packages prefixed `frontend-` belong to the new frontend system.

---

## 2. TypeScript Conventions

These rules come directly from [`STYLE.md`](./STYLE.md) and are enforced throughout the codebase.

### Naming

- **PascalCase** for types, interfaces, enums, and enum values.
- **camelCase** for functions, methods, properties, and local variables.
- Do **not** prefix interfaces with `I`.
- Do **not** prefix private properties with `_`.
- Type parameters are prefixed with `T` → `Request<TBody>`.
- Use whole words; abbreviate only when widely accepted (e.g. `id`, `url`).

### Syntax

- Prefer `undefined` over `null`.
- Prefer `for...of` over `.forEach`.
- Do not pollute the global namespace with new types or values.
- Use `function` keyword for exported functions and React components — **not** arrow functions — so API Extractor renders them correctly in docs.

### API Design

- Prefer a single **options object** over many positional arguments.
- Prefer **response objects** over bare arrays as return types (supports future pagination/metadata).
- Use **interfaces** for public contracts; use **classes** for implementations.
- Implementation class names: prefix describes behavior; suffix is the interface name.

  ```ts
  interface ImageLoader { ... }
  class DefaultImageLoader implements ImageLoader { ... }
  class CachingImageLoader implements ImageLoader { ... }
  ```

- Keep constructors **private**; expose **static factory methods**:
  - `static create(options?)` — primary factory
  - `static fromConfig(config, deps)` — when reading from Backstage config
  - `static fromUrl(url)` — URL-based construction
  - `/** @internal */ static forTesting(...)` — only for test access

- Prefer common **prefixes** over suffixes for related constants:

  ```ts
  const WIDGET_LABEL_GITHUB = 'github';
  const WIDGET_LABEL_GITLAB = 'gitlab';
  ```

- Prefix related types with the name of the owning symbol:
  - Component props → `MyComponentProps`
  - Operation options → `UpgradeWidgetOptions`
  - Request types → `UploadReportsRequest`

---

## 3. Plugin Architecture

Every plugin, frontend or backend, follows the same high-level structure:

```
plugins/<plugin-id>/
  src/
    index.ts          ← re-exports only; no implementation
    plugin.ts         ← plugin instance definition
    routes.ts         ← route refs (frontend only)
    api.ts            ← API interface, ref, and default impl (optional)
    components/       ← React components (frontend only)
      <ComponentName>/
        index.ts
        <ComponentName>.tsx
        <ComponentName>.test.tsx
    service/          ← express router and business logic (backend only)
      router.ts
      router.test.ts
  dev/
    index.ts          ← dev server setup
  package.json
```

### Key rules

1. `index.ts` **only re-exports**; it must contain no implementation.
2. All route refs live in `routes.ts` to prevent circular import issues.
3. Each React component lives in its own subdirectory with a matching `index.ts`.
4. Test files are co-located with the source file they test (`*.test.ts` / `*.test.tsx`).

---

## 4. Frontend Plugin Patterns (New System)

Use `@backstage/frontend-plugin-api` for all new plugin work.

### Minimal plugin

```ts
// src/plugin.ts
import { createFrontendPlugin } from '@backstage/frontend-plugin-api';

export const examplePlugin = createFrontendPlugin({
  pluginId: 'example',
  extensions: [],
});
```

```ts
// src/index.ts
export { examplePlugin as default } from './plugin';
```

> The **default export** of the package must be the plugin instance — this enables zero-config installation.

### Adding a page extension

```ts
// src/routes.ts
import { createRouteRef } from '@backstage/frontend-plugin-api';

export const rootRouteRef = createRouteRef();
```

```tsx
// src/plugin.ts
import {
  createFrontendPlugin,
  PageBlueprint,
  NavItemBlueprint,
} from '@backstage/frontend-plugin-api';
import { rootRouteRef } from './routes';

// Extensions are NOT exported from the package; only the plugin is.
const examplePage = PageBlueprint.make({
  params: {
    routeRef: rootRouteRef,
    path: '/example',
    // Always use dynamic imports for page components.
    loader: () =>
      import('./components/ExamplePage').then(m => <m.ExamplePage />),
  },
});

const exampleNavItem = NavItemBlueprint.make({
  params: {
    routeRef: rootRouteRef,
    title: 'Example',
    icon: ExampleIcon,
  },
});

export const examplePlugin = createFrontendPlugin({
  pluginId: 'example',
  extensions: [examplePage, exampleNavItem],
  routes: {
    root: rootRouteRef,
  },
});
```

### Plugin-specific entity content extension

```tsx
import { EntityContentBlueprint } from '@backstage/plugin-catalog-react/alpha';

const exampleEntityContent = EntityContentBlueprint.make({
  params: {
    path: 'example',
    title: 'Example',
    loader: () =>
      import('./components/ExampleEntityContent').then(m => (
        <m.ExampleEntityContent />
      )),
  },
});
```

### Utility API in the new system

```ts
// src/api.ts
import { createApiRef } from '@backstage/frontend-plugin-api';

export interface ExampleApi {
  getExample(): { example: string };
}

// New-system API refs use the builder form.
export const exampleApiRef = createApiRef<ExampleApi>().with({
  id: 'plugin.example.api',
  pluginId: 'example',
});

export class DefaultExampleApi implements ExampleApi {
  getExample() {
    return { example: 'Hello World!' };
  }
}
```

```ts
// in src/plugin.ts — register the API factory
import { ApiBlueprint } from '@backstage/frontend-plugin-api';
import { exampleApiRef, DefaultExampleApi } from './api';

const exampleApi = ApiBlueprint.make({
  name: 'example',
  params: defineParams =>
    defineParams({
      api: exampleApiRef,
      deps: {},
      factory: () => new DefaultExampleApi(),
    }),
});
```

### Dev server

```ts
// dev/index.ts
import { createDevApp } from '@backstage/frontend-dev-utils';
import myPlugin from '../src';

createDevApp({ features: [myPlugin] });
```

---

## 5. Frontend Plugin Patterns (Legacy System)

Use `@backstage/core-plugin-api` for legacy-system plugins (packages prefixed `core-`).

### Plugin instance

```ts
// src/plugin.ts
import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

/**
 * The example plugin instance.
 *
 * @public
 */
export const examplePlugin = createPlugin({
  id: 'example',
  routes: {
    root: rootRouteRef,
  },
});

/**
 * The main page component for the example plugin.
 *
 * @public
 */
export const ExamplePage = examplePlugin.provide(
  createRoutableExtension({
    name: 'ExamplePage',
    component: () =>
      import('./components/ExamplePage').then(m => m.ExamplePage),
    mountPoint: rootRouteRef,
  }),
);
```

### Route refs

```ts
// src/routes.ts
import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'example',
});
```

### Utility API in legacy system

```ts
import { createApiRef } from '@backstage/core-plugin-api';

export const exampleApiRef = createApiRef<ExampleApi>({
  id: 'plugin.example.service',
});
```

> Note: `createApiRef({ id })` is the legacy form. For new code, prefer the builder form from `@backstage/frontend-plugin-api`.

---

## 6. Backend Plugin Patterns

Use `@backstage/backend-plugin-api` for all backend plugins.

### Plugin instance

```ts
// src/plugin.ts
import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

/**
 * The example backend plugin.
 *
 * @public
 */
export const examplePlugin = createBackendPlugin({
  pluginId: 'example',
  register(env) {
    env.registerInit({
      deps: {
        httpAuth: coreServices.httpAuth,
        logger: coreServices.logger,
        httpRouter: coreServices.httpRouter,
      },
      async init({ httpAuth, logger, httpRouter }) {
        httpRouter.use(
          await createRouter({ httpAuth, logger }),
        );
        // Always expose a /health endpoint as unauthenticated.
        httpRouter.addAuthPolicy({
          path: '/health',
          allow: 'unauthenticated',
        });
      },
    });
  },
});
```

### Express router

```ts
// src/service/router.ts
import express from 'express';
import Router from 'express-promise-router';   // ← always use promise-router
import { InputError } from '@backstage/errors';
import { HttpAuthService, LoggerService } from '@backstage/backend-plugin-api';

export interface RouterOptions {
  logger: LoggerService;
  httpAuth: HttpAuthService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth } = options;

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    logger.info('PONG!');
    res.json({ status: 'ok' });
  });

  router.post('/items', async (req, res) => {
    // Always verify credentials on mutating endpoints.
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });

    if (!isValidCreateRequest(req.body)) {
      throw new InputError('Invalid payload');
    }

    // ... business logic
    res.json(result);
  });

  return router;
}
```

**Router rules:**

- Always use `express-promise-router` so async errors propagate automatically.
- Always expose a `/health` endpoint marked `allow: 'unauthenticated'`.
- Validate request bodies with type-guard functions; throw `InputError` on bad input.
- Call `httpAuth.credentials(req, { allow: ['user'] })` on all authenticated endpoints.
- Service / domain logic lives in a separate file (e.g. `todos.ts`), not in the router.

### Backend module

```ts
import {
  coreServices,
  createBackendModule,
} from '@backstage/backend-plugin-api';

export const exampleModuleGithub = createBackendModule({
  pluginId: 'example',
  moduleId: 'github',
  register(env) {
    env.registerInit({
      deps: { /* ... */ },
      async init({ /* ... */ }) {
        // extend the plugin
      },
    });
  },
});
```

---

## 7. Common / Shared Package Patterns

The `-common` package contains types and constants shared between the frontend and backend.

```
plugins/example-common/
  src/
    index.ts          ← re-exports only
    permissions.ts    ← permission definitions
    types.ts          ← shared domain types
```

### Permissions

```ts
// src/permissions.ts
import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Permission for creating an item.
 *
 * @public
 */
export const exampleCreatePermission = createPermission({
  name: 'example.item.create',
  attributes: { action: 'create' },
});

/**
 * All permissions exported from the example plugin.
 *
 * @public
 */
export const examplePermissions = [exampleCreatePermission];
```

Permission name format: `<plugin-id>.<resource>.<action>` — all lowercase, dot-separated.

---

## 8. React Component Patterns

### Use `@backstage/core-components` for structural layout

```tsx
import {
  Header,
  Page,
  Content,
  ContentHeader,
  HeaderLabel,
  SupportButton,
  Table,
  TableColumn,
  Progress,
} from '@backstage/core-components';

export function ExamplePage() {
  return (
    <Page themeId="tool">
      <Header title="My Plugin" subtitle="Does something useful">
        <HeaderLabel label="Owner" value="Team X" />
        <HeaderLabel label="Lifecycle" value="Alpha" />
      </Header>
      <Content>
        <ContentHeader title="Section Title">
          <SupportButton>Brief description of the plugin.</SupportButton>
        </ContentHeader>
        {/* content */}
      </Content>
    </Page>
  );
}
```

### Use Material UI components directly

Import MUI components individually (not from the barrel), matching the existing code style:

```ts
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import Button from '@material-ui/core/Button';
```

### Async data fetching

Use `react-use`'s `useAsync` for read operations:

```tsx
import useAsync from 'react-use/esm/useAsync';
import { Progress } from '@backstage/core-components';
import Alert from '@material-ui/lab/Alert';

export function ItemList() {
  const { value, loading, error } = useAsync(async () => {
    const res = await fetch('...');
    return res.json();
  }, []);

  if (loading) return <Progress />;
  if (error)   return <Alert severity="error">{error.message}</Alert>;

  return <MyTable data={value ?? []} />;
}
```

### Error notifications

Use `alertApiRef` for user-facing error messages:

```tsx
const alertApi = useApi(alertApiRef);

try {
  // ...
} catch (e: any) {
  alertApi.post({ message: e.message, severity: 'error' });
}
```

### Exported vs. internal components

- **Export** top-level page components and any components intended for external use.
- Keep helper components (like `AddTodo`, `EditModal`) **unexported** and defined in the same file as their consumer.
- Always define exported React components with the `function` keyword (not arrow functions).

---

## 9. API Client & Utility API Patterns

### Consuming APIs in React components

```tsx
import {
  discoveryApiRef,
  fetchApiRef,
  useApi,
} from '@backstage/core-plugin-api';

export function MyComponent() {
  const discoveryApi = useApi(discoveryApiRef);
  const { fetch } = useApi(fetchApiRef);

  const handleSubmit = async () => {
    const baseUrl = await discoveryApi.getBaseUrl('my-plugin-id');
    const response = await fetch(`${baseUrl}/resource`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const { error } = await response.json();
      // handle error
    }
  };
}
```

**Rules:**
- Always use `discoveryApiRef` to resolve backend base URLs — never hardcode them.
- Always use `fetchApiRef` for HTTP calls — not the global `fetch` — so authentication is handled automatically.
- Check `response.ok` after every fetch call.

### Defining a custom Utility API

```ts
// src/api.ts
import { createApiRef } from '@backstage/frontend-plugin-api';

export interface MyApi {
  getData(): Promise<MyData[]>;
}

// New-system: builder form with pluginId
export const myApiRef = createApiRef<MyApi>().with({
  id: 'plugin.my-plugin.api',
  pluginId: 'my-plugin',
});

export class DefaultMyApi implements MyApi {
  static create(): DefaultMyApi {
    return new DefaultMyApi();
  }

  private constructor() {}

  async getData(): Promise<MyData[]> {
    // implementation
  }
}
```

---

## 10. Error Handling

Use `@backstage/errors` for all thrown errors:

```ts
import {
  NotFoundError,
  InputError,
  ConflictError,
  AuthenticationError,
} from '@backstage/errors';

// Throw typed errors
throw new NotFoundError(`Item '${id}' not found`);
throw new InputError('Invalid payload');

// Check error types by name (not instanceof)
if (error.name === 'NotFoundError') { ... }

// Convert fetch error responses
import { ResponseError } from '@backstage/errors';
if (!res.ok) {
  throw await ResponseError.fromResponse(res);
}
```

---

## 11. Permissions

### In the common package — define permissions

```ts
import { createPermission } from '@backstage/plugin-permission-common';

export const myCreatePermission = createPermission({
  name: 'my-plugin.resource.create',
  attributes: { action: 'create' },
});

export const myPermissions = [myCreatePermission];
```

### In the backend — enforce permissions

```ts
import { permissions } from '@backstage/backend-plugin-api';
import { myCreatePermission } from '@backstage/plugin-my-plugin-common';

// In router initialization deps:
deps: {
  permissions: coreServices.permissions,
  httpAuth: coreServices.httpAuth,
}

// In a route handler:
router.post('/items', async (req, res) => {
  const credentials = await httpAuth.credentials(req, { allow: ['user'] });
  const decision = await permissions.authorize(
    [{ permission: myCreatePermission }],
    { credentials },
  );
  if (decision[0].result === AuthorizeResult.DENY) {
    throw new NotAllowedError();
  }
  // proceed
});
```

### In the frontend — guard UI

```tsx
import { usePermission } from '@backstage/plugin-permission-react';
import { myCreatePermission } from '@backstage/plugin-my-plugin-common';

export function CreateButton() {
  const { allowed } = usePermission({ permission: myCreatePermission });
  return allowed ? <Button>Create</Button> : null;
}
```

---

## 12. Testing Patterns

### General rules (from `AGENTS.md`)

- Prefer **fewer thorough tests** with multiple assertions over many small single-assertion tests.
- When using React Testing Library, prefer `screen` and `.findBy*` (async) queries over `waitFor`.

### Backend router tests

```ts
// src/service/router.test.ts
import { mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

describe('createRouter', () => {
  let app: express.Express;

  beforeAll(async () => {
    const router = await createRouter({
      logger: mockServices.logger.mock(),
      httpAuth: mockServices.httpAuth.mock(),
    });
    app = express().use(router);
  });

  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /health', () => {
    it('returns ok', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toEqual(200);
      expect(response.body).toEqual({ status: 'ok' });
    });
  });
});
```

**Key rules:**
- Use `mockServices` from `@backstage/backend-test-utils` for all service dependencies.
- Use `supertest` for HTTP-level tests.
- Create the app once in `beforeAll`; reset mocks in `beforeEach`.
- Test files are co-located with the source (`router.test.ts` next to `router.ts`).

### Frontend plugin smoke tests

```ts
// src/plugin.test.ts
import { myPlugin } from './plugin';

describe('my-plugin', () => {
  it('should export plugin', () => {
    expect(myPlugin).toBeDefined();
  });
});
```

### Running tests

```bash
CI=1 yarn test <path>   # always provide a path
```

---

## 13. Documentation Guidelines

All public symbols must have TSDoc comments.

```ts
/**
 * Short one-line summary (shown in the API index).
 *
 * @remarks
 *
 * Longer explanation goes here. Use @remarks to split long descriptions
 * so the index only shows the summary.
 *
 * @param options - The options for this operation.
 * @returns The created widget.
 *
 * @public
 */
export function createWidget(options: CreateWidgetOptions): Widget { ... }
```

- Use `@public` / `@alpha` / `@beta` / `@internal` release tags on every export.
- Use `{@link SomeName}` to cross-reference other symbols.
- Do **not** destructure parameters in public function signatures — destructure inside the body instead.
- Define exported React components with `function` keyword, not arrow functions.

---

## 14. File & Export Conventions

| File | Rule |
|------|------|
| `index.ts` | Re-exports only; no implementation |
| `plugin.ts` | Plugin instance definition |
| `routes.ts` | All `createRouteRef` / `createSubRouteRef` calls |
| `api.ts` | API interface, `ApiRef`, and default implementation |
| `types.ts` | Shared types for the package |
| `permissions.ts` | Permission definitions (in `-common` package) |
| `setupTests.ts` | Jest setup for the package |

**Naming:**
- Name the file after its main export when there is only one significant export.
- Keep `index.ts` free from implementation.
- Shared types belong in `types.ts`, not in the files that use them.

---

## 15. Tooling and Commands

```bash
yarn install                  # install all workspace dependencies

CI=1 yarn test <path>         # run tests for a file or directory
yarn tsc                      # type-check the entire project (root only)
yarn prettier --write <paths> # format specific changed files
yarn lint --fix               # lint and auto-fix
yarn build:api-reports        # regenerate API reports before opening a PR
yarn start                    # start the example app (frontend :3000 / backend :7007)
yarn new                      # scaffold a new plugin, package, or module
```

**Never run** `yarn build`, `yarn changesets version`, or `yarn release` — these are reserved for CI workflows.

### Changesets

Every change to a publishable package in `/packages` or `/plugins` must be accompanied by a changeset. See `REVIEWING.md` for guidance on writing changeset descriptions.

### ESLint / Prettier / TypeScript config

Never modify `.eslintrc.js`, prettier config, or `tsconfig.json` unless explicitly asked.

---

## Quick Reference: Package Imports by Context

| Context | API import |
|---------|-----------|
| New frontend plugin | `@backstage/frontend-plugin-api` |
| Legacy frontend plugin | `@backstage/core-plugin-api` |
| React components | `@backstage/core-components` |
| Backend plugin | `@backstage/backend-plugin-api` |
| Backend test mocks | `@backstage/backend-test-utils` |
| Error types | `@backstage/errors` |
| Permissions (shared) | `@backstage/plugin-permission-common` |
| Permissions (frontend) | `@backstage/plugin-permission-react` |
| Catalog entity info | `@backstage/plugin-catalog-react` |
