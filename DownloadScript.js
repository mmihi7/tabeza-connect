// DownloadScript.js - JScript custom action for WiX
function DownloadMainApp() {
    try {
        var shell = new ActiveXObject("WScript.Shell");
        var fso = new ActiveXObject("Scripting.FileSystemObject");
        var url = "https://github.com/Tabeza/TabezaConnect/releases/download/v" + 
                  Session.Property("Version") + "/TabezaConnect.exe";
        var filePath = Session.Property("INSTALLFOLDER") + "\\TabezaConnect.exe";
        
        // Create the directory if it doesn't exist
        var folderPath = Session.Property("INSTALLFOLDER");
        if (!fso.FolderExists(folderPath)) {
            fso.CreateFolder(folderPath);
        }
        
        // Download the file using XMLHTTP
        var http = new ActiveXObject("MSXML2.ServerXMLHTTP.6.0");
        http.open("GET", url, false);
        http.setRequestHeader("User-Agent", "Tabeza-Installer/1.0");
        http.send();
        
        if (http.status === 200) {
            var stream = new ActiveXObject("ADODB.Stream");
            stream.type = 1; // adTypeBinary
            stream.open();
            stream.write(http.responseBody);
            stream.saveToFile(filePath, 2); // adSaveCreateOverWrite
            stream.close();
            
            Session.Message("Download complete: " + filePath);
            return 0; // Success
        } else {
            Session.Message("Download failed with status: " + http.status);
            return 1; // Failure
        }
    } catch (e) {
        Session.Message("Error downloading file: " + e.message);
        return 1; // Failure
    }
}