# Instrucciones para Claude Code

## Al iniciar cada sesión

1. Leer `PROJECT.md` para entender el estado actual del proyecto
2. Si haces cambios significativos, actualizar `PROJECT.md` (estructura, status, notas)

## Reglas

- Nunca hardcodear API keys — siempre usar variables de entorno
- No commitear .env, *.db, ni uploads/
- El backend usa Claude Opus 4.6 — no cambiar modelo sin consultar
- La transcripción es local (faster-whisper), no API externa
- Mantener PROJECT.md actualizado como fuente de verdad del proyecto

## Regla de propagación entre proyectos

Cuando se agregue una mejora al PROJECT.md de este proyecto que pueda beneficiar a otros proyectos (nueva sección, mejor formato, nueva convención), se debe:

1. Documentar la mejora en el Changelog de este proyecto
2. Agregar una nota en la sección de Changelog indicando que es una mejora propagable
3. El Project Monitor Dashboard detectará automáticamente las diferencias de estructura entre proyectos y mostrará alertas de "Falta: [sección]" para los proyectos que no tengan las secciones estándar

### Secciones estándar que todo PROJECT.md debe tener:
- **Nombre y descripción** (H1 + párrafo)
- **Versión actual** (`Versión: X.Y.Z`)
- **Stack tecnológico**
- **Variables de entorno** (tabla clasificada)
- **Estructura de archivos**
- **Status actual**
- **Roadmap** (sprints ejecutados y planificados)
- **Bugs conocidos** (tabla con severidad y status)
- **Changelog** (historial de cambios por versión)
- **Siguientes pasos recomendados**
- **Notas para Claude Code**

