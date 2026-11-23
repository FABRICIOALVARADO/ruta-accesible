@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>&1
if errorlevel 1 goto usar_python
py -3.13 -V >nul 2>&1
if errorlevel 1 goto usar_python
py -3.13 -m scripts.iniciar
goto resultado
:usar_python
python -m scripts.iniciar
:resultado
if errorlevel 1 pause
