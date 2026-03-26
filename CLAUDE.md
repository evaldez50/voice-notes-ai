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
