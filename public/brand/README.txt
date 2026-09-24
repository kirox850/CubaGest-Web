COLOCA AQUÍ EL LOGO DE CUBAGEST
===============================

1. Exporta tu logo como PNG (idealmente cuadrado, 512×512 px o 1024×1024 px,
   fondo transparente o sólido, el que prefieras).

2. Nómbralo exactamente:  logo.png

3. Colócalo en esta carpeta, es decir en la ruta pública:
       public/brand/logo.png

4. Haz commit y push. Listo.

Dónde aparecerá automáticamente:
- Landing page (navbar)
- Header superior de la app (junto al nombre "CubaGest")

No hay que tocar ningún archivo de código: el componente BrandLogo lo detecta
solo (si el archivo no existe, muestra un monograma "C" por defecto).

Tamaños recomendados (opcionales, si también quieres actualizar el set PWA):
- public/icons/icon-192.png  (192×192)
- public/icons/icon-512.png  (512×512)
- public/icons/icon-180.png  (180×180, apple-touch-icon)

Nota: el favicon ya lo tienes custom (public/favicon.ico) — ese no se toca.

CAPTURAS DE LA APP PARA EL IPHONE DE LA LANDING
===============================================

La landing muestra cinco capturas verticales dentro del mockup de iPhone.
El componente las rota automáticamente cada 6 segundos con una transición
suave de fade.

Nombres reservados para el set:
       public/brand/foto1.jpg
       public/brand/foto2.jpg
       public/brand/foto3.jpg
       public/brand/foto4.jpg
       public/brand/foto5.jpg

Recomendado: capturas de POS, Dashboard o flujos principales en formato
vertical, con una relación aproximada de 9:19.5 y una resolución mínima de
900×1950 px.
