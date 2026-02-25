' Tabeza POS Connect Configuration Script
' Handles BarID setup and printer detection

Sub ConfigureApp()
    On Error Resume Next
    
    ' Get installation folder
    Dim installPath, configPath, barId
    installPath = Session.Property("INSTALLFOLDER")
    configPath = installPath & "\config.json"
    
    ' Log configuration start
    Session.Log "Starting Tabeza POS Connect configuration..."
    Session.Log "Install path: " & installPath
    Session.Log "Config path: " & configPath
    
    ' Check if config exists
    Dim fso
    Set fso = CreateObject("Scripting.FileSystemObject")
    
    If Not fso.FileExists(configPath) Then
        Session.Log "Config file not found, creating default configuration..."
        
        ' Create default config
        Dim configFile
        Set configFile = fso.CreateTextFile(configPath, True)
        configFile.WriteLine "{"
        configFile.WriteLine "  ""barId"": """","
        configFile.WriteLine "  ""port"": 8765,"
        configFile.WriteLine "  ""autoStart"": true,"
        configFile.WriteLine "  ""checkForUpdates"": true"
        configFile.WriteLine "}"
        configFile.Close
        
        Session.Log "Default config created"
    End If
    
    ' Prompt for BarID if not set
    Dim shell, barIdInput
    Set shell = CreateObject("WScript.Shell")
    
    ' Read current config to check BarID
    If fso.FileExists(configPath) Then
        Dim configFileContent, barIdValue
        Set configFile = fso.OpenTextFile(configPath, 1)
        configFileContent = configFile.ReadAll
        configFile.Close
        
        ' Check if BarID is empty
        If InStr(configFileContent, """barId"": """"") > 0 Then
            ' Prompt user for BarID
            barIdInput = InputBox("Please enter your BarID for Tabeza POS Connect:", "Tabeza POS Connect Setup", "")
            
            If barIdInput <> "" Then
                ' Update config with BarID
                configFileContent = Replace(configFileContent, """barId"": """"", """barId"": """ & barIdInput & """")
                
                Set configFile = fso.OpenTextFile(configPath, 2)
                configFile.Write configFileContent
                configFile.Close
                
                Session.Log "BarID set to: " & barIdInput
            End If
        End If
    End If
    
    ' Start the application to detect printers
    Session.Log "Starting TabezaConnect.exe for printer detection..."
    shell.Run """" & installPath & "\TabezaConnect.exe"" --detect-printers", 0, False
    
    ' Show completion message
    shell.Popup "Tabeza POS Connect has been configured successfully!" & vbCrLf & _
               "BarID: " & barIdInput & vbCrLf & _
               "Printer detection initiated." & vbCrLf & _
               vbCrLf & "You can now launch Tabeza POS Connect from the Start Menu.", 10, "Setup Complete", 64
    
    Session.Log "Configuration completed successfully"
End Sub
