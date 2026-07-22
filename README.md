# CubaGest Web

## Deploy en Cloudflare Pages (5 pasos)

1. Sube esta carpeta a un repo en GitHub (puede ser privado)
2. Ve a https://pages.cloudflare.com → "Create a project" → conecta tu GitHub
3. Selecciona el repo y configura:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Haz clic en "Save and Deploy"
5. Listo — tu URL será algo como `cubagest-web.pages.dev`

## Backend
Ya conectado a: https://cubagest-backend-production.up.railway.app/api

## Desarrollo local
```bash
npm install
npm run dev
```
