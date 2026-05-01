# Guía para crear el Ejecutable (.exe)

Has solicitado que esta Aplicación Web pueda ser empaquetada como un software de escritorio `.exe`. Como ya construimos el proyecto usando **React, Vite y Node.js**, el método más rápido y estándar de la industria es utilizar **Electron**.

A continuación tienes los pasos exactos para empaquetarla:

### Requisitos previos:
1. Asegúrate de tener instalado **Node.js** en tu computadora (descárgalo de nodejs.org).
2. Descarga el código fuente de esta aplicación (en AI Studio puedes exportarlo como ZIP).
3. Extrae el archivo ZIP en una carpeta en tu computadora, abre una terminal en esa carpeta y ejecuta:
   \`\`\`bash
   npm install
   \`\`\`

### Paso 1: Instalar Electron
Dentro de la terminal de tu proyecto, instala electron y el empaquetador como dependencias de desarrollo:
\`\`\`bash
npm install --save-dev electron electron-builder wait-on concurrently
\`\`\`

### Paso 2: Crear el archivo de inicio de Electron
Crea un archivo llamado \`electron-main.js\` en la raíz de tu proyecto (junto a \`package.json\`) y pega el siguiente código:
\`\`\`javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 880,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // En producción, carga los archivos generados por Vite
  win.loadFile(path.join(__dirname, 'dist', 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
\`\`\`

### Paso 3: Modificar \`package.json\`
Abre tu \`package.json\` y añade las configuraciones para Electron. Debe verse algo así (añade lo que falta):

\`\`\`json
{
  "name": "farmacia-erp",
  "version": "1.0.0",
  "main": "electron-main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "electron:start": "concurrently -k \"npm run dev\" \"wait-on tcp:3000 && electron .\"",
    "electron:build": "npm run build && electron-builder",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "build": {
    "appId": "com.farmaciaerp.app",
    "productName": "Farmacia ERP",
    "directories": {
      "output": "dist-electron"
    },
    "files": [
      "dist/**/*",
      "electron-main.js"
    ],
    "win": {
      "target": "nsis"
    }
  }
}
\`\`\`

*(Nota: En Vite.config.ts, asegúrate de añadir \`base: './',\` dentro de \`defineConfig({...})\` para que las rutas funcionen en formato escritorio).*

### Paso 4: Generar tu Ejecutable (.exe)
Con todo listo, ejecuta el siguiente comando en tu terminal para compilar la aplicación:

\`\`\`bash
npm run electron:build
\`\`\`

¡Listo! Cuando termine, tendrás tu archivo **`.exe` instalador** o portable dentro de la carpeta \`dist-electron\` creada en tu proyecto. Podrás llevarlo a cualquier otra computadora Windows y usarlo como una aplicación nativa, resolviendo de manera segura las lecturas locales de Excel sin dependencia de un servidor en la nube.
