# Omega inventarios

Aplicación de escritorio para la cadena de farmacias (16 sucursales). Cruza un Excel de existencias con uno de ventas, calcula la rotación de cada producto y sugiere:

- **Traspasos** entre sucursales (de donde sobra a donde se vende).
- **Compras** de los productos que se venden y ya no hay.

## Cómo usarla

1. **Cargar datos**: sube el Excel de existencias y el de ventas, y calcula.
2. **Alertas**: revisa los traspasos y compras sugeridos.
3. **Inventario**: consulta el detalle por producto y sucursal.

Los datos se guardan en el navegador (IndexedDB); no se suben a ningún servidor.

## Cómo correrla

Requiere [Node.js](https://nodejs.org).

```bash
npm install
npm run dev      # abre http://localhost:3000
```

Otros comandos:

```bash
npm run lint     # revisa los tipos con TypeScript
npm run build    # genera la versión final en dist/
```

## Variables de entorno

Opcionales. Copia `.env.example` a `.env.local` y ajusta:

| Variable | Para qué sirve |
| --- | --- |
| `VITE_API_BASE_URL` | Dirección del sistema al que se envían los traspasos. |
| `VITE_API_TOKEN` | Token de acceso. Si no existe, el envío funciona en modo de prueba y no manda nada. |
