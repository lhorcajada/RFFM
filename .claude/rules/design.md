# Reglas de Diseño (/design y Artifacts)

- Los archivos de un diseño (`project/canvas.json`, `project/*.dc.html`) se escriben **siempre dentro del proyecto**, en `.design/<nombre_diseño>/` (p. ej. `.design/injured/project/Main.dc.html`), nunca en el directorio scratchpad ni en `Temp`: la publicación desde ahí queda bloqueada por una regla de permisos de lectura.
- Al publicar con la herramienta Artifact, usar `root` = `<repo>/.design/<nombre_diseño>` y `file_path` = ruta absoluta de `project/canvas.json` dentro de esa carpeta.
- Estos archivos son borradores de trabajo: no commitearlos salvo petición explícita del usuario.
