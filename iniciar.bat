@echo off
echo ============================================
echo   Voice Notes AI - Iniciando...
echo ============================================

echo Iniciando backend (FastAPI)...
start "Backend - Voice Notes AI" cmd /k "cd backend && venv\Scripts\activate && python main.py"

timeout /t 3 /nobreak > nul

echo Iniciando frontend (Vite)...
start "Frontend - Voice Notes AI" cmd /k "cd frontend && npm run dev"

timeout /t 2 /nobreak > nul

echo.
echo Abriendo en el navegador...
start http://localhost:5173

echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo.
echo Cierra las ventanas del terminal para detener los servidores.
