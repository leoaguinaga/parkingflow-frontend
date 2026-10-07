# ParkFlow Frontend

Interfaz web de ParkFlow: Next.js 16 (App Router), React 19, Tailwind CSS 4 y componentes shadcn/ui (Base UI). No habla directamente con la base de datos: las peticiones a `/api/*` se reenvían a la API Spring Boot mediante un route handler (`app/api/[...path]/route.ts`).

## Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | 20.9 o posterior |
| pnpm | 10 (`corepack enable` o `npm i -g pnpm@10`) |
| ParkFlow API | en ejecución (ver [`apps/api/README.md`](../api/README.md)) |

Usa **pnpm**; el repositorio incluye `pnpm-lock.yaml`.

## Instalación

### 1. Levantar la API

El frontend necesita la API corriendo (por defecto en `http://localhost:8080`) con la base de datos migrada y una cuenta administradora creada. Sigue los pasos de [`apps/api/README.md`](../api/README.md).

### 2. Instalar dependencias

```sh
cd apps/frontend
pnpm install
```

### 3. Configurar variables de entorno

```sh
cp .env.example .env.local
```

| Variable | Descripción | Por defecto |
| --- | --- | --- |
| `API_INTERNAL_URL` | Dirección interna desde la que Next.js llega a Spring Boot | `http://localhost:8080` |

Si cambiaste `PORT` en la API, actualiza este valor. Si cambiaste el puerto del frontend, actualiza `FRONTEND_ORIGIN` en el `.env` de la API.

### 4. Iniciar en desarrollo

```sh
pnpm dev
```

Abre http://localhost:3000 e inicia sesión con la cuenta administradora creada con `--create-admin`.

## Scripts

| Comando | Acción |
| --- | --- |
| `pnpm dev` | Servidor de desarrollo en el puerto 3000 |
| `pnpm lint` | ESLint |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build de producción (ejecuta `pnpm build` antes) |

## Producción

```sh
pnpm build
API_INTERNAL_URL=<endpoint-interno-de-la-api> pnpm start
```

Configura `API_INTERNAL_URL` con el endpoint interno apropiado, no con una URL pública innecesaria. La API debe usar `COOKIE_SECURE=true` bajo HTTPS y `FRONTEND_ORIGIN` con el dominio real del frontend. Hay un `.dockerignore` incluido para construir una imagen del frontend.

## Problemas frecuentes

- **Errores 502/500 al iniciar sesión o cargar datos**: la API no está corriendo o `API_INTERNAL_URL` apunta a otra dirección.
- **Errores de CORS o sesión que no persiste**: `FRONTEND_ORIGIN` en la API no coincide con el origen desde el que abres el frontend.
- **Puerto 3000 ocupado**: `pnpm dev -p 3001` (y actualiza `FRONTEND_ORIGIN` en la API).
- **Dependencias inconsistentes**: borra `node_modules` y repite `pnpm install`.
