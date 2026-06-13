# Planilla de Salarios — Guía de instalación

Sistema de liquidación semanal de salarios con autenticación, roles y base de datos compartida.

---

## Paso 1 — Crear proyecto en Supabase

1. Entrá a [supabase.com](https://supabase.com) y creá una cuenta gratuita
2. Hacé clic en **New project**
3. Poné un nombre (ej: `planilla-salarios`), elegí una contraseña fuerte y la región más cercana (São Paulo)
4. Esperá ~2 minutos a que se cree el proyecto

---

## Paso 2 — Ejecutar el SQL de configuración

1. En Supabase, andá a **SQL Editor** (ícono de base de datos en el sidebar)
2. Hacé clic en **New query**
3. Copiá todo el contenido del archivo `sql/setup.sql` y pegalo ahí
4. Hacé clic en **Run** (o F5)
5. Verificá que diga `Success` en el panel inferior

---

## Paso 3 — Obtener las credenciales de Supabase

1. En Supabase, andá a **Settings → API**
2. Copiá:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon / public key** (la clave larga que empieza con `eyJ...`)

---

## Paso 4 — Configurar el proyecto

1. Abrí el archivo `js/config.js`
2. Reemplazá los valores:

```javascript
const SUPABASE_URL = 'https://TU_PROYECTO.supabase.co';   // ← tu URL
const SUPABASE_ANON_KEY = 'TU_ANON_KEY';                   // ← tu clave
```

---

## Paso 5 — Crear los usuarios

Los usuarios se crean desde Supabase Auth (no desde la app, por seguridad):

1. En Supabase, andá a **Authentication → Users**
2. Hacé clic en **Add user → Create new user**
3. Ingresá email y contraseña para cada usuario
4. Después de crearlo, andá a **Table Editor → perfiles**
5. Buscá el usuario recién creado y editá:
   - `nombre`: nombre completo
   - `rol`: `admin` o `readonly`

Repetí para los 5 usuarios (4 admin + 1 readonly).

---

## Paso 6 — Subir a GitHub Pages

### Opción A — Desde GitHub.com (sin instalar nada)

1. Entrá a [github.com](https://github.com) y creá una cuenta si no tenés
2. Hacé clic en **New repository**
3. Nombre: `planilla-salarios`, marcá **Public**, creá el repositorio
4. Subí los archivos arrastrándolos a la pantalla o usando **Add file → Upload files**
5. Subí toda la estructura de carpetas:
   ```
   index.html
   css/app.css
   js/config.js
   js/auth.js
   js/db.js
   js/calculos.js
   js/ui.js
   js/app.js
   ```
6. Hacé commit con el mensaje `Initial commit`

### Activar GitHub Pages

1. En el repositorio, andá a **Settings → Pages**
2. En **Source**, elegí **Deploy from a branch**
3. En **Branch**, elegí `main` y carpeta `/ (root)`
4. Hacé clic en **Save**
5. En 1-2 minutos tu app estará en: `https://TU_USUARIO.github.io/planilla-salarios`

---

## Paso 7 — Configurar dominio en Supabase (importante)

Para que Supabase acepte los logins desde tu URL de GitHub Pages:

1. En Supabase, andá a **Authentication → URL Configuration**
2. En **Site URL**, poné: `https://TU_USUARIO.github.io/planilla-salarios`
3. En **Redirect URLs**, agregá la misma URL
4. Guardá los cambios

---

## Uso básico

### Primera vez
1. Entrá a tu URL de GitHub Pages
2. Ingresá con las credenciales que creaste en Supabase
3. Ir a **Configuración** y verificar el salario mínimo (Gs. 2.899.046)
4. Ir a **Feriados** → **Cargar feriados PY 2026** para precargar todos los feriados
5. Ir a **Empleados** y agregar o verificar el listado

### Cada semana
1. Ir a **Semanas** → **Nueva semana** (elegí las fechas lun–sáb)
2. Ir a **Empleados** → **Importar marcaciones** → subí el XLS del reloj
3. Verificar en **Feriados** si alguno aplica a esa semana y marcarlo como trabajado
4. Ir a **Liquidación**, seleccioná la semana y hacé clic en **Calcular semana**
5. Revisá el **Detalle extras** para verificar cada concepto
6. Exportá el CSV si necesitás

---

## Estructura de archivos

```
planilla-salarios/
├── index.html          ← página principal
├── css/
│   └── app.css         ← estilos
├── js/
│   ├── config.js       ← URL y clave de Supabase ← EDITÁ ESTO
│   ├── auth.js         ← login y sesiones
│   ├── db.js           ← consultas a la base de datos
│   ├── calculos.js     ← lógica de liquidación
│   ├── ui.js           ← interfaz y modales
│   └── app.js          ← app principal
└── sql/
    └── setup.sql       ← ejecutar una sola vez en Supabase
```

---

## Seguridad

- **HTTPS** automático en GitHub Pages
- **Supabase Auth** maneja las contraseñas (bcrypt internamente, nunca se guardan en texto plano)
- **Row Level Security (RLS)** en todas las tablas: el usuario `readonly` no puede escribir nada a nivel de base de datos, no solo en la interfaz
- **Anon key** es segura para el frontend: solo permite lo que las políticas RLS permiten
- Las sesiones expiran automáticamente (1 hora por defecto en Supabase, configurable)

---

## ¿Necesitás ayuda?

Cualquier consulta sobre la instalación, configuración de usuarios o adaptaciones al sistema, avisá.
