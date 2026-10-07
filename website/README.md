# Prisma · Website

Landing en español para la aplicación Prisma. HTML/CSS/JavaScript estáticos, sin dependencias de ejecución. El instalador de Windows se compila desde la aplicación Electron de la raíz del repositorio.

## Vista previa

Desde esta carpeta:

```powershell
npm run dev
```

Abre http://127.0.0.1:4173.

## Comprobación y publicación

```powershell
npm run build
npx vercel --prod
```

`vercel.json` selecciona `dist` como único directorio público. No publica herramientas de captura, perfiles, pruebas ni credenciales. En Vercel, selecciona `website` como Root Directory si importas el repositorio completo. Framework: Other. Build: `npm run build`. Output: `dist`.

El proyecto de Vercel es `prisma-recorder`, con web pública en https://prisma-recorder.vercel.app, y está vinculado a la cuenta del propietario. La publicación permanente necesita una sesión autenticada de Vercel. Las credenciales `.vercel` y `.env*` están excluidas del repositorio y del directorio público.

## Contenido y demo

- Diez capturas de la app real en `assets/screenshots`.
- Tour interactivo de once pasos con foco, tarjeta, avance, retroceso, reinicio, pantalla completa y teclado.
- Navegación por capturas, ampliación en modal, guía de instalación y preguntas frecuentes.
- `tour-position.js` reutiliza la lógica de colocación de SaviaLanding que proporcionó el usuario. El recorrido y las zonas de foco son específicos de Prisma.
- La demo usa capturas y resaltados visuales; se recorre con Siguiente y Anterior, sin tener que clicar el resaltado. No ejecuta el grabador, solicita permisos ni conecta dispositivos. Se identifica como demo guiada.
- La presentación y el guion de las capturas son públicos y de demostración. No muestran el escritorio ni la cámara del usuario.

Para repetir las capturas consulta `tools/README.md`. `assets/screenshots/manifest.json` documenta sus dimensiones y procedencia.

El proyecto y su descarga de Windows están en GitHub. La versión actual tiene licencia PolyForm Noncommercial 1.0.0 y no tiene plan Premium. Los botones de descarga apuntan al archivo `Prisma-Setup-0.1.0-Windows-x64.exe` de la release `v0.1.0`; la guía de instalación no requiere comandos.
