using System;
using System.IO;
using System.Net;
using System.Windows.Forms;
using Microsoft.Deployment.WindowsInstaller;

namespace CustomActions
{
    public class DownloadActions
    {
        [CustomAction]
        public static ActionResult DownloadMainApp(Session session)
        {
            try
            {
                string version = "1.2.0";
                string downloadUrl = $"https://github.com/billoapp/TabezaConnect/releases/download/v{version}/TabezaConnect.exe";
                string tempPath = Path.GetTempPath();
                string filePath = Path.Combine(tempPath, "TabezaConnect.exe");
                
                session.Log("Starting download from: " + downloadUrl);
                
                using (WebClient client = new WebClient())
                {
                    client.DownloadProgressChanged += (sender, e) =>
                    {
                        int progress = e.ProgressPercentage;
                        session.Message(InstallMessage.ActionData, $"Downloading... {progress}%");
                    };
                    
                    client.DownloadFile(downloadUrl, filePath);
                }
                
                session.Log("Download completed to: " + filePath);
                
                // Copy to installation directory
                string installPath = session["INSTALLFOLDER"];
                string finalPath = Path.Combine(installPath, "TabezaConnect.exe");
                
                File.Copy(filePath, finalPath, true);
                File.Delete(filePath);
                
                session.Log("File copied to: " + finalPath);
                
                return ActionResult.Success;
            }
            catch (Exception ex)
            {
                session.Log("Download failed: " + ex.Message);
                MessageBox.Show("Download failed: " + ex.Message, "Tabeza POS Connect", MessageBoxButtons.OK, MessageBoxIcon.Error);
                return ActionResult.Failure;
            }
        }
    }
}
