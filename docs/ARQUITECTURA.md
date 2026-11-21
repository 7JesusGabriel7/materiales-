# Arquitectura y Diseno del Sistema POS - Casa de Materiales

Este documento cubre el analisis de requerimientos, la arquitectura de software, la estructura de carpetas, el diseno de la base de datos, el funcionamiento de Docker y el flujo de comunicacion entre frontend, backend y MySQL.

---

## 1. Analisis de Requerimientos

### Requerimientos funcionales
1. **Modulo de ventas (POS)**:
   - Busqueda rapida por nombre o codigo (SKU) y filtro por categoria.
   - Carrito interactivo con incremento, decremento, edicion directa de cantidad (incluye fracciones para materiales a granel como metros cubicos o toneladas), eliminacion de partidas y limpieza del carrito.
   - Calculo automatico de importes por linea, subtotal, total, cambio a entregar y faltante cuando el pago es insuficiente.
   - Bloqueo de ventas con pago insuficiente o existencias insuficientes.
   - Registro atomico mediante transaccion SQL: folio unico, fecha y hora, snapshot de productos y precios, descuento de existencias, registro en historial de movimientos de inventario y generacion inmediata del ticket de 58 mm.
2. **Administracion de productos y categorias**:
   - Alta, edicion, busqueda y baja de productos (desactivacion logica si ya tienen ventas historicas; eliminacion fisica si nunca se han vendido).
   - Soporte obligatorio de las 7 unidades de medida: Pieza, Bulto, Kilogramo, Tonelada, Metro, Metro cubico y Viaje.
   - Registro automatico de fecha de creacion y ultima modificacion.
3. **Control de inventario**:
   - Sincronizacion directa con las ventas confirmadas.
   - Alertas de productos con pocas existencias y agotados.
   - Entradas, salidas manuales y ajustes directos con motivo obligatorio.
   - Historial auditable de todos los movimientos (`movimientos_inventario`).
4. **Historial y consulta de ventas anteriores**:
   - Consulta de ventas del dia actual y dias anteriores mediante filtros (Hoy, Dia anterior, Semana actual, Mes actual, Fecha especifica, Rango personalizado y Numero de folio).
   - Resumen agregado calculado directamente en MySQL (hoy, ayer, semana, mes y acumulado total).
   - Visualizacion de detalle completo con conservacion permanente de nombres y precios historicos aunque el catalogo cambie despues.
   - Reimpresion de ticket termico de 58 mm desde cualquier venta anterior.
5. **Impresion de tickets de 58 mm**:
   - Hoja CSS dedicada (`frontend/css/ticket.css`) con regla `@page { size: 58mm auto; margin: 0; }` y `@media print` que oculta toda la interfaz administrativa y solo imprime el comprobante.

### Requerimientos no funcionales
- Interfaz administrativa profesional, limpia, minimalista, adaptable a computadoras, tabletas y celulares, completamente en espanol y libre de emojis o elementos decorativos innecesarios.
- Separacion estricta entre frontend (HTML5, CSS3 independiente sin Tailwind, JavaScript modular ES6) y backend (Node.js + Express + mysql2).
- Despliegue completo y reproducible mediante Docker Compose con volumen persistente para MySQL.

---

## 2. Arquitectura del Sistema

El sistema utiliza una arquitectura en **3 capas desacopladas** ejecutadas en contenedores independientes dentro de una misma red privada de Docker (`pos_network`):

1. **Capa de Presentacion (Frontend - Nginx `1.27-alpine`)**:
   - Sirve los archivos estaticos (`index.html`, hojas CSS en `css/` y modulos JavaScript en `js/`).
   - Actua como **proxy inverso** para toda solicitud dirigida a `/api/`, reenviandola internamente a `http://backend:3000/api/`. Esto evita problemas de CORS y permite acceder al sistema desde cualquier dispositivo de la red local usando una sola direccion y puerto (`http://localhost:8080`).
2. **Capa de Aplicacion / API REST (Backend - Node.js 20 + Express)**:
   - Organizada por responsabilidades: `config`, `middlewares`, `utils`, `routes`, `controllers` y `services`.
   - Valida entradas, aplica redondeo decimal monetario/cuantitativo, coordina transacciones SQL (`BEGIN`, `FOR UPDATE`, `COMMIT`, `ROLLBACK`) y expone endpoints JSON en `/api/*`.
3. **Capa de Datos (Base de Datos - MySQL 8.0)**:
   - Motor InnoDB con juego de caracteres `utf8mb4` y tipo `DECIMAL` para todos los valores monetarios y cantidades.
   - Almacena los archivos fisicos de datos en el volumen persistente `mysql_data` (`/var/lib/mysql`).

---

## 3. Estructura de Carpetas

```text
Casa materiales/
├── .env                         # Variables de entorno activas (no subir a repositorios)
├── .env.example                 # Plantilla documentada de variables de entorno
├── .gitignore
├── docker-compose.yml           # Orquestacion de servicios db, backend y frontend
├── README.md                    # Guia rapida de despliegue, comandos y uso
├── docs/
│   └── ARQUITECTURA.md          # Analisis, arquitectura, BD y comunicacion
├── database/
│   ├── schema.sql               # Definicion DDL pura de referencia
│   └── init.sql                 # Inicializacion automatica de BD y catalogo inicial
├── backend/
│   ├── .dockerignore
│   ├── Dockerfile               # Imagen Node.js 20 Alpine con tzdata
│   ├── package.json
│   └── src/
│       ├── app.js               # Configuracion de Express, CORS, rutas y errores
│       ├── server.js            # Arranque del servidor HTTP y cierre limpio
│       ├── config/
│       │   ├── env.js           # Lectura centralizada de variables de entorno
│       │   └── database.js      # Pool mysql2, reintentos y helper conTransaccion
│       ├── middlewares/
│       │   ├── errorHandler.js  # Clase AppError y manejo global de errores SQL/HTTP
│       │   └── validate.js      # Validadores de enteros, decimales y texto
│       ├── utils/
│       │   ├── formatters.js    # Redondeos, generador de folios y fechas ISO
│       │   └── dateRanges.js    # Filtros parametrizados de fechas para ventas
│       ├── routes/
│       │   ├── index.js
│       │   ├── categorias.routes.js
│       │   ├── productos.routes.js
│       │   ├── inventario.routes.js
│       │   └── ventas.routes.js
│       ├── controllers/
│       │   ├── config.controller.js
│       │   ├── categorias.controller.js
│       │   ├── productos.controller.js
│       │   ├── inventario.controller.js
│       │   └── ventas.controller.js
│       └── services/
│           ├── categorias.service.js
│           ├── productos.service.js
│           ├── inventario.service.js
│           └── ventas.service.js
└── frontend/
    ├── Dockerfile               # Imagen Nginx Alpine
    ├── nginx.conf               # Configuracion web y proxy inverso /api/
    ├── index.html               # Contenedor unico y secciones del POS
    ├── css/
    │   ├── variables.css        # Paleta neutra, tipografia y espaciados
    │   ├── base.css             # Reset, accesibilidad y numeros tabulares
    │   ├── layout.css           # Menu lateral, barra superior y diseño adaptable
    │   ├── components.css       # Tablas, formularios, modales, botones y tarjetas
    │   ├── pos.css              # Distribucion de dos columnas del modulo de ventas
    │   └── ticket.css           # Vista previa y reglas @media print para 58 mm
    └── js/
        ├── app.js               # Enrutador de vistas y estado global
        ├── api/
        │   └── client.js        # Cliente HTTP fetch hacia /api
        ├── utils/
        │   ├── format.js        # Formateo MXN, cantidades, fechas y escape HTML
        │   ├── modal.js         # Modales reutilizables y dialogos de confirmacion
        │   └── toast.js         # Notificaciones operativas no intrusivas
        └── modules/
            ├── pos.js           # Modulo de ventas y cobro
            ├── productos.js     # Catalogo de productos y categorias
            ├── inventario.js    # Alertas, movimientos manuales e historial de stock
            ├── historial.js     # Resumen, filtros, detalle y reimpresion de ventas
            └── ticket.js        # Renderizado e impresion de ticket termico 58 mm
```

---

## 4. Diseno de la Base de Datos (MySQL 8.0)

### Tablas y relaciones
1. **`categorias`**
   - `id` (PK), `nombre` (UNIQUE), `descripcion`, `fecha_creacion`.
   - Se relaciona `1:N` con `productos` (`ON UPDATE CASCADE ON DELETE RESTRICT`).
2. **`productos`**
   - `id` (PK), `codigo` (UNIQUE), `nombre` (INDEX), `categoria_id` (FK), `descripcion`, `precio_venta` (`DECIMAL(12,2)`), `existencias` (`DECIMAL(12,3)`), `stock_minimo` (`DECIMAL(12,3)`), `unidad_medida` (`ENUM` con las 7 unidades requeridas), `activo`, `fecha_registro`, `fecha_modificacion`.
   - Restricciones `CHECK`: precios, existencias y stock minimo mayores o iguales a cero.
3. **`ventas`**
   - `id` (PK), `folio` (UNIQUE, formato `VTA-YYYYMMDD-000001`), `fecha_venta` (INDEX), `cantidad_productos`, `total_unidades`, `subtotal`, `total`, `dinero_recibido`, `cambio` (todos los montos en `DECIMAL(12,2)`), `estado` (`COMPLETADA` / `CANCELADA`).
   - Restricciones `CHECK`: `dinero_recibido >= total`, montos no negativos.
4. **`detalle_ventas`**
   - `id` (PK), `venta_id` (FK -> `ventas.id`, `ON DELETE RESTRICT`), `producto_id` (FK -> `productos.id`, `ON DELETE SET NULL`), `producto_codigo`, `producto_nombre`, `unidad_medida`, `cantidad` (`DECIMAL(12,3)`), `precio_unitario` (`DECIMAL(12,2)`), `importe` (`DECIMAL(12,2)`).
   - **Conservacion historica**: Al guardar `producto_codigo`, `producto_nombre`, `unidad_medida` y `precio_unitario` en cada renglon de `detalle_ventas`, cualquier cambio futuro de precio o nombre en el catalogo (o baja del producto) jamas altera los importes ni los tickets de ventas pasadas.
5. **`movimientos_inventario`**
   - `id` (PK), `producto_id` (FK -> `productos.id`, `ON DELETE SET NULL`), `producto_codigo`, `producto_nombre`, `venta_id` (FK -> `ventas.id`, `ON DELETE SET NULL`), `tipo` (`ENTRADA`, `SALIDA`, `SALIDA_VENTA`, `AJUSTE`), `cantidad` (`DECIMAL(12,3)`), `stock_anterior` (`DECIMAL(12,3)`), `stock_nuevo` (`DECIMAL(12,3)`), `motivo`, `fecha_movimiento`.

---

## 5. Funcionamiento de Docker

El archivo `docker-compose.yml` coordina 3 contenedores interconectados mediante la red bridge `pos_network`:

1. **Servicio `db` (`mysql:8.0`)**:
   - Carga credenciales y base de datos desde `.env`.
   - Monta el volumen nombrado `mysql_data:/var/lib/mysql` para conservar permanentemente productos, movimientos y ventas aunque los contenedores se detengan o eliminen.
   - Ejecuta `./database/init.sql` unicamente cuando el volumen esta vacio en el primer arranque.
   - Incluye un `healthcheck` con `mysqladmin ping` cada 10 segundos.
2. **Servicio `backend` (`./backend/Dockerfile`)**:
   - Espera automaticamente (`condition: service_healthy`) a que MySQL acepte conexiones.
   - Instala `tzdata` para alinear fechas y horas de Node.js con la variable `TZ`.
   - Expone su propia verificacion de salud en `GET /api/health`.
3. **Servicio `frontend` (`./frontend/Dockerfile`)**:
   - Espera a que el backend este saludable (`condition: service_healthy`).
   - Sirve el sistema web en el puerto configurado (`APP_PORT`, por defecto `8080`).

---

## 6. Comunicacion Frontend - Backend - MySQL

1. El usuario accede desde navegador (PC, tableta o celular) a `http://<servidor>:8080`.
2. Nginx entrega `index.html`, hojas CSS y modulos JavaScript.
3. Los modulos JS consumen endpoints relativos bajo `/api/...` usando `fetch` (`frontend/js/api/client.js`).
4. Nginx intercepta `/api/` y lo reenvia por la red interna de Docker hacia `http://backend:3000/api/`.
5. Express enruta la peticion al controlador correspondiente, delega la logica al servicio y ejecuta consultas parametrizadas o transacciones ACID sobre `db:3306` mediante el pool `mysql2/promise`.
6. Para `POST /api/ventas`, el backend bloquea con `FOR UPDATE` los registros de `productos` involucrados ordenados por `id`, valida stock y pago en servidor, calcula totales desde los precios de la base de datos, inserta `ventas` y `detalle_ventas`, descuenta `productos.existencias`, registra `SALIDA_VENTA` en `movimientos_inventario` y confirma con `COMMIT` (o revierte todo con `ROLLBACK` ante cualquier error).

