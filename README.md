# Sistema de Punto de Venta (POS) - Casa de Materiales

Sistema web completo de Punto de Venta, presupuestos, entregas programadas, directorio de clientes, administracion de catalogo, control de inventario e historial de ventas con impresion termica de tickets de 58 mm y descarga de notas en PDF, disenado para casas de materiales de construccion.

Documentacion tecnica detallada: [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md).

---

## Stack Tecnologico

- **Frontend**: HTML5, CSS3 (hojas de estilo independientes, sin Tailwind CSS), JavaScript modular (ES Modules), servido mediante Nginx.
- **Backend**: Node.js 20, Express, mysql2, cors, dotenv, pdfkit.
- **Base de datos**: MySQL 8.0 (InnoDB, `utf8mb4`, `DECIMAL` para importes y cantidades).
- **Infraestructura**: Docker y Docker Compose con volumen persistente y healthchecks.

---

## Configuracion Inicial

1. Verificar que Docker y Docker Compose esten instalados y en ejecucion.
2. Copiar `.env.example` a `.env` antes de iniciar en un servidor nuevo (el archivo `.env` no se incluye en el repositorio por seguridad):

```bash
cp .env.example .env
```

Principales variables en `.env`:
- `TZ`: Zona horaria del negocio (por defecto `America/Mexico_City`).
- `APP_PORT`: Puerto web para abrir el sistema en el navegador (por defecto `8080`).
- `BACKEND_PORT`: Puerto expuesto de la API Express (por defecto `3000`).
- `DB_EXTERNAL_PORT`: Puerto de MySQL en el host (por defecto `3306`).
- `MYSQL_ROOT_PASSWORD`, `MYSQL_DATABASE`, `MYSQL_USER`, `MYSQL_PASSWORD`: Credenciales de MySQL.
- `NEGOCIO_NOMBRE`, `NEGOCIO_DIRECCION`, `NEGOCIO_TELEFONO`, `NEGOCIO_RFC`, `NEGOCIO_MENSAJE_TICKET`: Datos iniciales del establecimiento.

---

## Comandos de Docker Compose

### Iniciar todo el sistema
Construye las imagenes si no existen e inicia los contenedores en segundo plano (`db`, `backend` y `frontend`):

```bash
docker compose up -d
```

Al finalizar el arranque, abra el sistema en el navegador en:

```text
http://localhost:8080
```

### Verificar estado y salud de los contenedores

```bash
docker compose ps
```

### Consultar los registros (logs) de los contenedores
Para ver todos los servicios en tiempo real:

```bash
docker compose logs -f
```

Para consultar un servicio especifico (`db`, `backend` o `frontend`):

```bash
docker compose logs -f backend
docker compose logs -f db
docker compose logs -f frontend
```

### Detener los servicios
Detiene y elimina los contenedores manteniendo intactos los datos de MySQL en el volumen persistente `pos_materiales_mysql_data`:

```bash
docker compose down
```

Nota: No ejecutar `docker compose down -v` en produccion, ya que la bandera `-v` elimina el volumen de base de datos.

### Reconstruir los contenedores
Despues de realizar cambios en el codigo del frontend o del backend:

```bash
docker compose up -d --build
```

---

## Base de datos en blanco para pruebas (`database/bd_en_blanco.sql`)

El repositorio incluye el archivo `database/bd_en_blanco.sql` con la estructura completa de todas las tablas de MySQL sin registros (`0` filas), util para inicializar un entorno desde cero o realizar pruebas limpias.

Para importarla en el contenedor `db`:

```bash
docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/bd_en_blanco.sql
```

Si desea reiniciar una base de datos de pruebas existente desde cero y cargar unicamente la estructura en blanco:

```bash
docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "DROP DATABASE IF EXISTS \`$MYSQL_DATABASE\`; CREATE DATABASE \`$MYSQL_DATABASE\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"'
docker compose exec -T db sh -c 'mysql -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' < database/bd_en_blanco.sql
```

### Respaldo manual de la base de datos

```bash
docker compose exec -T db sh -c 'mysqldump -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE"' > respaldo_pos.sql
```

---

## Modulos del Sistema

1. **Ventas (POS)**: Vista en tarjetas y lista, busqueda por nombre, filtro por categoria, soporte de cantidades enteras y fraccionarias (minimo 1), calculo de cambio o faltante, flujo de cobro general o con cliente y entrega programada, creacion de presupuestos sin afectar stock, ticket termico de 58 mm y descarga en PDF.
2. **Presupuestos**: Registro y consulta de cotizaciones sin afectar ventas ni inventario, carga en el POS para concretar venta, ticket de 58 mm y descarga en PDF.
3. **Entregas programadas y clientes**: Seguimiento de pedidos con cliente, fecha/horario de entrega, direccion, notas de venta, cambio de estado (Pendiente / Entregado), directorio de clientes y descarga de nota en PDF.
4. **Productos**: Vista en tarjetas, alta, edicion, eliminacion o desactivacion segura, categorias personalizables, 7 unidades de medida y opcion de productos sin control de stock.
5. **Inventario**: Resumen de productos activos, alertas de pocas existencias y agotados, registro de entradas, salidas manuales y ajustes, y bitacora completa de movimientos.
6. **Historial de ventas**: Resumen de ventas de hoy y del dia anterior, filtros por periodo o folio, detalle con precios historicos inmutables, reimpresion de ticket de 58 mm y descarga de nota de venta en PDF.
7. **Configuracion**: Edicion en vivo de nombre, direccion, telefono, RFC, mensaje del ticket e ilustracion del camion de volteo para tickets y PDFs.

---

## Endpoints Principales de la API

- `GET /api/health`: Estado del servidor y conexion a MySQL.
- `GET / PUT /api/config`: Datos del establecimiento y unidades de medida.
- `GET / POST / PUT / DELETE /api/categorias`: Administracion de categorias.
- `GET / POST / PUT / DELETE /api/productos`: Administracion de catalogo.
- `GET / POST / PUT / DELETE /api/clientes`: Directorio de clientes.
- `GET /api/inventario/resumen`, `GET /api/inventario/bajo-stock`, `GET / POST /api/inventario/movimientos`: Control de inventario.
- `GET / POST /api/ventas`, `GET /api/ventas/resumen`, `GET /api/ventas/:id`, `GET /api/ventas/:id/pdf`: Registro, consulta y descarga en PDF de ventas.
- `GET / POST / PATCH / DELETE /api/presupuestos`, `GET /api/presupuestos/:id/pdf`: Cotizaciones y descarga en PDF.
- `GET / PUT / PATCH /api/entregas`, `GET /api/entregas/:id/pdf`: Entregas programadas y descarga en PDF de su nota.
