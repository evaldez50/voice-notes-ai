@echo off
echo ============================================
echo   Voice Notes AI - Instalacion
echo ============================================

echo.
echo [1/3] Instalando dependencias del backend (Python)...
cd backend
python -m venv venv
call venv\Scripts\activate
pip install -r requirements.txt
cd ..

echo.
echo [2/3] Instalando dependencias del frontend (Node)...
cd frontend
npm install
cd ..

echo.
echo [3/3] Configurando variables de entorno...
if not exist backend\.env (
    copy backend\.env.example backend\.env
    echo IMPORTANTE: Edita backend\.env y agrega tu ANTHROPIC_API_KEY
)

echo.
echo ============================================
echo   Instalacion completa!
echo   Siguiente paso: edita backend\.env
echo   Luego ejecuta: iniciar.bat
echo ============================================
pause
