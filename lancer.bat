@echo off
chcp 65001 >nul
setlocal
set "ROOT=%~dp0"

echo.
echo  Flash OPS
echo  API    http://localhost:8080
echo  Front  http://localhost:4201
echo.

call :ecoute 8080
if errorlevel 1 (
  echo  API deja lancee.
) else (
  echo  Demarrage de l'API...
  start "Flash OPS API" powershell.exe -NoExit -ExecutionPolicy Bypass -File "%ROOT%backend\run-dev.ps1"
)

call :ecoute 4201
if errorlevel 1 (
  echo  Front deja lance.
) else (
  if not exist "%ROOT%front\node_modules\" (
    echo  Installation des dependances front...
    pushd "%ROOT%front"
    call npm install
    popd
  )
  echo  Demarrage du front...
  start "Flash OPS Front" /D "%ROOT%front" cmd /k "npx ng serve --port 4201"
)

echo  Attente de l'API...
set /a TRIES=0
:wait_api
call :ecoute 8080
if errorlevel 1 goto api_ok
set /a TRIES+=1
if %TRIES% GEQ 45 (
  echo  L'API ne repond pas. Regardez la fenetre "Flash OPS API".
  goto done
)
timeout /t 2 >nul
goto wait_api

:api_ok
echo  API prete.
start "" "http://localhost:4201"

:done
echo.
echo  Deux fenetres restent ouvertes : API et Front.
echo  Fermez-les pour arreter les serveurs.
echo.
timeout /t 4 >nul
endlocal
exit /b 0

:ecoute
netstat -ano | findstr /C:":%~1 " | findstr /C:"LISTENING" >nul
if %errorlevel%==0 exit /b 1
exit /b 0
