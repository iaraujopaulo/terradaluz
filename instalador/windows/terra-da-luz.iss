; Instalador do Terra da Luz para Windows (Inno Setup 6)
;
; Empacota:
;   - o instalador do navegador gerado pelo Chromium (mini_installer.exe),
;   - o ajudante (atualizações automáticas, contêineres, modo IE),
;   - a janela do Modo Internet Explorer (TerraIE.exe),
;   - políticas e preferências iniciais (privacidade e extensões embutidas).
;
; Compilar:  ISCC.exe /DArquivoNavegador=..\..\saida\mini_installer.exe terra-da-luz.iss

#include "..\gerado\windows\versao.iss"

#ifndef ArquivoNavegador
  #define ArquivoNavegador "..\..\saida\mini_installer.exe"
#endif
#ifndef PastaBinarios
  #define PastaBinarios "..\..\saida"
#endif

[Setup]
AppId={{9C3E7A51-4B2D-4E8F-A1C6-2F7B9D0E5A33}
AppName=Terra da Luz
AppVersion={#VersaoTerra}
AppVerName=Terra da Luz {#VersaoTerra}
AppPublisher=Projeto Terra da Luz
AppComments=Navegador privado baseado no ungoogled-chromium
DefaultDirName={commonpf64}\TerraDaLuz\Ajudante
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir={#PastaBinarios}
OutputBaseFilename=TerraDaLuz-Setup-{#VersaoTerra}-x64
SetupIconFile=terra-da-luz.ico
UninstallDisplayIcon={commonpf64}\TerraDaLuz\Application\chrome.exe
UninstallDisplayName=Terra da Luz
WizardStyle=modern
WizardSizePercent=110
Compression=lzma2/ultra64
SolidCompression=yes
CloseApplications=yes
RestartApplications=no
SetupLogging=yes

[Languages]
Name: "ptbr"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Messages]
ptbr.WelcomeLabel1=Bem-vindo ao Terra da Luz
ptbr.WelcomeLabel2=Um navegador rápido e privado: sem telemetria do Google, com proteção contra rastreadores e golpes, contêineres, modo Internet Explorer e extensões da Chrome Web Store.%n%nClique em Avançar para instalar.

[Tasks]
Name: "atalho"; Description: "Criar atalho na área de trabalho"; Flags: checkedonce
Name: "padrao"; Description: "Usar o Terra da Luz como navegador padrão"; Flags: unchecked

[Files]
Source: "{#ArquivoNavegador}"; DestDir: "{tmp}"; DestName: "navegador_instalador.exe"; Flags: deleteafterinstall
Source: "{#PastaBinarios}\terra-ajudante.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "{#PastaBinarios}\TerraIE.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\gerado\windows\terra-ajudante.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\gerado\windows\br.terradaluz.ajudante.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\gerado\windows\versao.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\gerado\windows\initial_preferences"; DestDir: "{commonpf64}\TerraDaLuz\Application"; Flags: ignoreversion

#include "..\gerado\windows\politicas.iss"

[Registry]
; host de mensagens nativas (o caminho do executável é relativo ao manifesto)
Root: HKLM64; Subkey: "SOFTWARE\TerraDaLuz\NativeMessagingHosts\br.terradaluz.ajudante"; ValueType: string; ValueData: "{app}\br.terradaluz.ajudante.json"; Flags: uninsdeletekey
Root: HKLM64; Subkey: "SOFTWARE\TerraDaLuz"; Flags: uninsdeletekeyifempty

[Run]
; 1) instala ou atualiza o navegador (Chromium) no nível do sistema
Filename: "{tmp}\navegador_instalador.exe"; Parameters: "--system-level --do-not-launch-chrome"; StatusMsg: "Instalando o navegador..."; Flags: waituntilterminated
; 2) atualizações automáticas: ao ligar o computador e a cada 6 horas
Filename: "{sys}\schtasks.exe"; Parameters: "/Create /F /TN ""TerraDaLuz\Atualizacao"" /TR ""\""{app}\terra-ajudante.exe\"" atualizar"" /SC HOURLY /MO 6 /RU SYSTEM /RL HIGHEST"; Flags: runhidden waituntilterminated; StatusMsg: "Configurando atualizações automáticas..."
Filename: "{sys}\schtasks.exe"; Parameters: "/Create /F /TN ""TerraDaLuz\AtualizacaoAoIniciar"" /TR ""\""{app}\terra-ajudante.exe\"" atualizar"" /SC ONSTART /DELAY 0005:00 /RU SYSTEM /RL HIGHEST"; Flags: runhidden waituntilterminated
; 3) abrir ao final (só na instalação interativa)
Filename: "{commonpf64}\TerraDaLuz\Application\chrome.exe"; Description: "Abrir o Terra da Luz agora"; Flags: postinstall nowait skipifsilent runasoriginaluser unchecked

[UninstallRun]
Filename: "{sys}\schtasks.exe"; Parameters: "/Delete /F /TN ""TerraDaLuz\Atualizacao"""; Flags: runhidden; RunOnceId: "TarefaAtualizacao"
Filename: "{sys}\schtasks.exe"; Parameters: "/Delete /F /TN ""TerraDaLuz\AtualizacaoAoIniciar"""; Flags: runhidden; RunOnceId: "TarefaInicio"

[UninstallDelete]
Type: filesandordirs; Name: "{app}\TerraDaLuz"
Type: files; Name: "{commonpf64}\TerraDaLuz\Application\initial_preferences"

[Code]
const
  ChaveDesinstalacao = 'SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\TerraDaLuz';

function CaminhoNavegador: String;
begin
  Result := ExpandConstant('{commonpf64}\TerraDaLuz\Application\chrome.exe');
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  Codigo: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    { Esconde a entrada duplicada do instalador interno do Chromium na lista
      de programas: a desinstalação acontece por esta entrada aqui. }
    if RegKeyExists(HKLM64, ChaveDesinstalacao) then
      RegWriteDWordValue(HKLM64, ChaveDesinstalacao, 'SystemComponent', 1);

    if WizardIsTaskSelected('atalho') then
      CreateShellLink(ExpandConstant('{commondesktop}\Terra da Luz.lnk'), 'Terra da Luz',
        CaminhoNavegador, '', ExpandConstant('{commonpf64}\TerraDaLuz\Application'), '', 0, SW_SHOWNORMAL);

    if WizardIsTaskSelected('padrao') then
      Exec(CaminhoNavegador, '--make-default-browser', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
  end;
end;

procedure CurUninstallStepChanged(CurUninstallStep: TUninstallStep);
var
  Comando, Executavel, Parametros: String;
  P, Codigo: Integer;
begin
  if CurUninstallStep = usUninstall then
  begin
    DeleteFile(ExpandConstant('{commondesktop}\Terra da Luz.lnk'));
    if RegQueryStringValue(HKLM64, ChaveDesinstalacao, 'UninstallString', Comando) then
    begin
      { UninstallString = "C:\...\setup.exe" --uninstall --system-level ... }
      Comando := Trim(Comando);
      if Copy(Comando, 1, 1) = '"' then
      begin
        Delete(Comando, 1, 1);
        P := Pos('"', Comando);
        Executavel := Copy(Comando, 1, P - 1);
        Parametros := Trim(Copy(Comando, P + 1, Length(Comando)));
      end
      else
      begin
        P := Pos(' ', Comando);
        Executavel := Copy(Comando, 1, P - 1);
        Parametros := Trim(Copy(Comando, P + 1, Length(Comando)));
      end;
      Exec(Executavel, Parametros + ' --force-uninstall', '', SW_HIDE, ewWaitUntilTerminated, Codigo);
    end;
  end;
end;
