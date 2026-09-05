# 🛡️ SENTINEL — Guardián de Privacidad & Orquestador de Eliminación de Datos

> *"SENTINEL no promete la magia imposible de borrar tus datos de internet con un botón. Es un guardián operativo: detecta dónde está expuesta tu identidad, te guía y orquesta las solicitudes legales de eliminación (GDPR / CCPA / Derecho al Olvido), y te alerta de inmediato si tus credenciales aparecen en filtraciones o en la dark web."*

---

## 🚀 Inicio Rápido

### 1. Requisitos Previos
* **Node.js:** v24.x o v22.x LTS (Recomendado).
* **NPM:** v11.x o superior.

### 2. Puesta en Marcha
```bash
# Iniciar servidor y dashboard interactivo
npm start

# Modo desarrollo con recarga en caliente automática
npm run dev

# Ejecutar suite de pruebas de integración
npm test
```

El servidor seleccionará automáticamente un puerto libre (por defecto `http://localhost:3001`), evitando colisiones con otros servicios.

---

## 🌐 Dashboard Web (Cyber-Obsidian Royal)

Abre tu navegador en `http://localhost:3001` para acceder a la consola central:
- **Índice de Exposición (Exposure Score 0-100):** Algoritmo en tiempo real basado en credenciales expuestas y cuentas mitigadas.
- **Auditor de Contraseñas k-Anonymity:** Comprueba si tu contraseña está comprometida en segundos sin enviarla por internet (utiliza prefijos SHA-1 de 5 caracteres).
- **Gestor de Identidades:** Monitoreo activo de correos electrónicos, números telefónicos y usuarios.
- **Motor de Eliminación GDPR (Art. 17 RGPD):** Catálogo de plataformas (Google, Meta, Amazon, Netflix, Telegram, Discord, etc.) con deep-links oficiales de borrado y generación de plantillas legales pre-llenadas.
- **Trazabilidad de Solicitudes:** Bitácora con cuenta regresiva del plazo legal de 30 días.

---

## 🔌 Endpoints de la API REST

### Autenticación y Perfil
* `GET /api/v1/auth/me` — Datos del usuario autenticado, métricas clave y estado de suscripción.

### Identidades
* `GET /api/v1/identities` — Lista de identidades monitoreadas con conteo de filtraciones.
* `POST /api/v1/identities` — Registro y sanitización de nueva identidad (`email`, `phone`, `username`).
* `DELETE /api/v1/identities/:id` — Desactivación / eliminación de identidad.

### Escaneo y Seguridad
* `POST /api/v1/scan` — Ejecuta escaneo profundo de filtraciones (HIBP API v3 / Fallback inteligente).
* `GET /api/v1/scan/exposure` — Cálculo del índice de exposición y recomendaciones de endurecimiento.
* `POST /api/v1/scan/password` — Auditoría segura k-Anonymity de contraseñas.
* `GET /api/v1/scan/breaches` — Historial de brechas detectadas.

### Motor de Eliminación GDPR
* `GET /api/v1/platforms` — Catálogo curado con filtros de categoría y dificultad.
* `GET /api/v1/platforms/:id` — Detalle y plantilla legal personalizada para el DPO.
* `GET /api/v1/requests` — Solicitudes de eliminación del usuario.
* `POST /api/v1/requests` — Registrar solicitud de eliminación formal.
* `PATCH /api/v1/requests/:id` — Actualizar estado (`pending`, `sent`, `confirmed`, `completed`).

---

## 🔒 Estándar de Seguridad Zero-Leakage
* Las claves privadas y tokens sensibles se gestionan exclusivamente en `.env` (ignorado por `.gitignore`).
* Las contraseñas auditadas nunca viajan completas por la red (protocolo k-Anonymity).
* Base de datos SQLite integrada en modo WAL con claves foráneas activas y consultas parametrizadas contra inyecciones SQL.

---

## 🧠 Cerebro Obsidian
La bitácora técnica, arquitectura, flujos de datos y ficha de presentación ejecutiva se encuentran sincronizados en:  
`C:\Users\mauro\OneDrive\Desktop\Cerebros_Obsidian\cerebro_sentinel\`
