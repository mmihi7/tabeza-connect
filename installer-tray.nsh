; Custom NSIS script for TabezaConnect Tray App
; This handles registry Run key for auto-start

!macro customInstall
  ; Create registry Run key for auto-start with --minimized flag
  DetailPrint "Creating auto-start registry entry..."
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TabezaConnect" "$INSTDIR\TabezaConnect.exe --minimized"
  
  ; Check if old service exists and remove it
  DetailPrint "Checking for existing Windows service..."
  nsExec::ExecToStack 'sc query "TabezaConnect"'
  Pop $0 ; return code
  Pop $1 ; output
  ${If} $0 = 0
    DetailPrint "Stopping existing service..."
    nsExec::Exec 'sc stop "TabezaConnect"'
    Sleep 2000
    DetailPrint "Deleting existing service..."
    nsExec::Exec 'sc delete "TabezaConnect"'
  ${EndIf}
  
  ; Create ProgramData directory if it doesn't exist
  CreateDirectory "$APPDATA\Tabeza"
  
  ; Copy existing config if upgrading
  IfFileExists "$PROGRAMFILES64\Tabeza\TabezaConnect\config.json" 0 +2
    CopyFiles "$PROGRAMFILES64\Tabeza\TabezaConnect\config.json" "$APPDATA\Tabeza\config.json"
!macroend

!macro customUnInstall
  ; Remove registry Run key
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "TabezaConnect"
  
  ; Remove app data directory (ask user)
  MessageBox MB_YESNO "Remove TabezaConnect configuration and logs?" IDNO skipRemove
    RMDir /r "$APPDATA\Tabeza"
  skipRemove:
!macroend
