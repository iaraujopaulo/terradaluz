@echo off
rem Compila o TerraIE.exe com o compilador C# que já vem no Windows.
setlocal
set CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe
if not exist "%CSC%" set CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe
if not exist "%CSC%" (
  echo Compilador C# do .NET Framework 4 nao encontrado.
  exit /b 1
)
cd /d "%~dp0"
"%CSC%" /nologo /optimize+ /target:winexe /platform:anycpu /codepage:65001 ^
  /win32icon:terra-da-luz.ico /win32manifest:app.manifest ^
  /r:System.dll /r:System.Drawing.dll /r:System.Windows.Forms.dll ^
  /out:TerraIE.exe TerraIE.cs
exit /b %ERRORLEVEL%
