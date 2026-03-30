@echo off
setlocal
echo.
echo  SafariPay Setup (Windows)
echo ================================
echo.

where node >nul 2>&1 || (echo ERROR: Node.js not found. Get it from https://nodejs.org & pause & exit /b 1)
for /f "tokens=*" %%v in ('node -v') do echo [OK] Node.js %%v

echo.
echo Installing backend dependencies...
cd backend && call npm install && echo [OK] Backend ready && cd ..

echo.
echo Installing frontend dependencies...
cd frontend && call npm install && echo [OK] Frontend ready && cd ..

echo.
echo ================================================================
echo  Database setup — run these commands in psql (as postgres user):
echo.
echo    CREATE USER safaripay WITH PASSWORD 'safaripay123';
echo    CREATE DATABASE safaripay OWNER safaripay;
echo    GRANT ALL PRIVILEGES ON DATABASE safaripay TO safaripay;
echo.
echo  Then import the database file:
echo    psql -U safaripay -d safaripay -f database\safaripay_database.sql
echo.
echo  OR use pgAdmin:
echo    Open pgAdmin → connect to 'safaripay' DB
echo    Tools → Query Tool → Open → database\safaripay_database.sql → F5
echo ================================================================
echo.
echo  NEXT STEPS:
echo.
echo  Terminal 1:  cd backend   ^&^& npm run dev
echo  Terminal 2:  cd frontend  ^&^& npm start
echo.
echo  App:  http://localhost:3000
echo  API:  http://localhost:4000/health
echo.
echo  Demo login: +255712345678 / PIN: 1234
echo.
pause
