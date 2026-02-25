!define APPNAME "Tabeza POS Connect"
!define COMPANY "Tabeza"
!ifndef VERSION
  !define VERSION "1.1.1"
!endif
!define EXECUTABLE "TabezaConnect.exe"
!define GITHUB_REPO "billoapp/TabezaConnect"

OutFile "TabezaConnect-Setup-${VERSION}.exe"

InstallDir "$PROGRAMFILES\${APPNAME}"

RequestExecutionLevel admin

ShowInstDetails show

; Modern UI
!include "MUI2.nsh"

; Interface Settings
!define MUI_ABORTWARNING
!define MUI_ICON "assets\icon.ico"

; Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_WELCOME
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_UNPAGE_FINISH

; Languages
!insertmacro MUI_LANGUAGE "English"

; Download function without plugin
Function DownloadFile
  Pop $0 ; URL
  Pop $1 ; Output file
  
  DetailPrint "Downloading ${APPNAME}..."
  DetailPrint "URL: $0"
  DetailPrint "Output: $1"
  
  ; Use PowerShell to download (built into Windows)
  nsExec::Exec 'powershell -Command "& {Invoke-WebRequest -Uri \"$0\" -OutFile \"$1\"}"'
  Pop $2
  
  StrCmp $2 "0" download_ok
  MessageBox MB_ICONSTOP "Download failed. Error code: $2$\n$\nPlease check your internet connection and try again."
  Abort
  
  download_ok:
  DetailPrint "Download completed successfully"
FunctionEnd

; Installer sections
Section "Install" SecMain

SetOutPath "$INSTDIR"

; Download using PowerShell
Push "https://github.com/${GITHUB_REPO}/releases/download/v${VERSION}/${EXECUTABLE}"
Push "$TEMP\${EXECUTABLE}"
Call DownloadFile

DetailPrint "Installing ${APPNAME}..."

; Copy downloaded file to installation directory
CopyFiles "$TEMP\${EXECUTABLE}" "$INSTDIR\${EXECUTABLE}"

; Clean up temp file
Delete "$TEMP\${EXECUTABLE}"

DetailPrint "Creating shortcuts..."

; Create desktop shortcut
CreateShortcut "$DESKTOP\${APPNAME}.lnk" "$INSTDIR\${EXECUTABLE}" "" "$INSTDIR"

; Create Start Menu shortcuts
CreateDirectory "$SMPROGRAMS\${APPNAME}"
CreateShortcut "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk" "$INSTDIR\${EXECUTABLE}" "" "$INSTDIR"
CreateShortcut "$SMPROGRAMS\${APPNAME}\Uninstall.lnk" "$INSTDIR\Uninstall.exe"

DetailPrint "Setting up auto-start..."

; Add to Windows startup (runs in system tray)
WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" \
                 "${APPNAME}" \
                 "$INSTDIR\${EXECUTABLE}"

DetailPrint "Creating uninstaller..."

; Create uninstaller
WriteUninstaller "$INSTDIR\Uninstall.exe"

; Add to Programs and Features
WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
                 "DisplayName" "${APPNAME}"
WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
                 "UninstallString" "$INSTDIR\Uninstall.exe"
WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
                 "DisplayIcon" "$INSTDIR\${EXECUTABLE}"
WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
                 "Publisher" "${COMPANY}"
WriteRegStr HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" \
                 "DisplayVersion" "${VERSION}"

DetailPrint "Installation complete!"

SectionEnd

; Uninstaller section
Section "Uninstall"

DetailPrint "Removing ${APPNAME}..."

; Remove auto-start
DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "${APPNAME}"

; Remove shortcuts
Delete "$DESKTOP\${APPNAME}.lnk"
Delete "$SMPROGRAMS\${APPNAME}\${APPNAME}.lnk"
Delete "$SMPROGRAMS\${APPNAME}\Uninstall.lnk"
RMDir "$SMPROGRAMS\${APPNAME}"

; Remove files and directories
Delete "$INSTDIR\${EXECUTABLE}"
Delete "$INSTDIR\Uninstall.exe"
RMDir "$INSTDIR"

; Remove from Programs and Features
DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}"

DetailPrint "Uninstallation complete."

SectionEnd

; Functions
Function .onInit

; Check if already installed
ReadRegStr $0 HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APPNAME}" "UninstallString"
StrCmp $0 "" done

MessageBox MB_OKCANCEL|MB_ICONEXCLAMATION "${APPNAME} is already installed. $\n$\nClick OK to remove the previous version or Cancel to cancel this upgrade." IDOK uninst
Abort

uninst:
ClearErrors
ExecWait '$0 _?=$INSTDIR'

IfErrors uninst_error done

uninst_error:
MessageBox MB_ICONEXCLAMATION "Error uninstalling previous version. Please uninstall manually and try again."
Abort

done:

FunctionEnd
