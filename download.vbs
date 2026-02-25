' Tabeza POS Connect Download Script
' No Visual Studio required - pure VBScript

Function DownloadMainApp()
    On Error Resume Next
    
    ' Configuration
    Dim version, downloadUrl, tempPath, filePath, installPath, finalPath
    version = "1.1.1"
    downloadUrl = "https://github.com/billoapp/TabezaConnect/releases/download/v" & version & "/TabezaConnect.exe"
    
    ' Get temporary folder
    tempPath = CreateObject("Scripting.FileSystemObject").GetSpecialFolder(2) ' 2 = Temporary Folder
    filePath = tempPath & "\TabezaConnect.exe"
    
    ' Get installation folder from MSI property
    installPath = Session.Property("INSTALLFOLDER")
    finalPath = installPath & "\TabezaConnect.exe"
    
    ' Log download start
    Session.Log "Starting download from: " & downloadUrl
    Session.Log "Target file: " & finalPath
    
    ' Download using XMLHTTP (built into Windows)
    Dim http, stream
    Set http = CreateObject("MSXML2.XMLHTTP")
    Set stream = CreateObject("ADODB.Stream")
    
    ' Try multiple URL formats if first fails
    Dim urls(3)
    urls(0) = "https://github.com/billoapp/TabezaConnect/releases/download/v" & version & "/TabezaConnect.exe"
    urls(1) = "https://github.com/billoapp/TabezaConnect/releases/download/v" & version & "/tabezaconnect.exe"
    urls(2) = "https://github.com/billoapp/TabezaConnect/releases/download/v" & version & "/TabezaConnect.exe"
    
    Dim i, success
    success = False
    
    For i = 0 To UBound(urls)
        Session.Log "Trying URL " & (i + 1) & ": " & urls(i)
        
        http.Open "GET", urls(i), False
        http.Send
        
        If http.Status = 200 Then
            ' Save downloaded file
            stream.Type = 1 ' adTypeBinary
            stream.Open
            stream.Write http.ResponseBody
            stream.SaveToFile filePath, 2 ' adSaveCreateOverWrite
            stream.Close
            
            Session.Log "Download completed from: " & urls(i)
            Session.Log "File saved to: " & filePath
            
            ' Copy to installation directory
            CreateObject("Scripting.FileSystemObject").CopyFile filePath, finalPath, True
            
            ' Clean up temp file
            CreateObject("Scripting.FileSystemObject").DeleteFile filePath
            
            Session.Log "File copied to: " & finalPath
            
            success = True
            Exit For
        Else
            Session.Log "Download failed with status: " & http.Status & " for URL: " & urls(i)
        End If
        
        ' Clear for next attempt
        http = Nothing
        stream = Nothing
    Next
    
    If success Then
        ' Return success
        DownloadMainApp = 1
        Session.Log "Download successful!"
    Else
        ' Show error message with details
        Session.Log "All download attempts failed"
        MsgBox "Download failed. Please check:" & vbCrLf & _
               "1. Internet connection" & vbCrLf & _
               "2. GitHub repository: billoapp/TabezaConnect" & vbCrLf & _
               "3. Release version: v" & version & vbCrLf & _
               "4. File name: TabezaConnect.exe" & vbCrLf & _
               vbCrLf & "Contact support if issue persists.", vbExclamation, "Tabeza POS Connect"
        
        ' Return failure
        DownloadMainApp = 0
    End If
End Function

' Progress notification
Sub ShowProgress(percent)
    Session.Message 3, "Downloading... " & percent & "%"
End Sub
