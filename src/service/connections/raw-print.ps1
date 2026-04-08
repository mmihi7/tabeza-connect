
param([string]$PrinterName, [string]$FilePath)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinter {
    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool OpenPrinter(string pPrinterName, out IntPtr phPrinter, IntPtr pDefault);

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", CharSet=CharSet.Auto, SetLastError=true)]
    public static extern int StartDocPrinter(IntPtr hPrinter, int Level, ref DOCINFO pDocInfo);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int dwCount, out int dwWritten);

    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Auto)]
    public struct DOCINFO {
        [MarshalAs(UnmanagedType.LPTStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPTStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPTStr)] public string pDataType;
    }

    public static bool SendRawBytes(string printerName, byte[] bytes) {
        IntPtr hPrinter;
        if (!OpenPrinter(printerName, out hPrinter, IntPtr.Zero)) return false;
        try {
            var di = new DOCINFO { pDocName = "TabezaReceipt", pOutputFile = null, pDataType = "RAW" };
            if (StartDocPrinter(hPrinter, 1, ref di) == 0) return false;
            try {
                if (!StartPagePrinter(hPrinter)) return false;
                int written;
                bool ok = WritePrinter(hPrinter, bytes, bytes.Length, out written);
                EndPagePrinter(hPrinter);
                return ok && written == bytes.Length;
            } finally {
                EndDocPrinter(hPrinter);
            }
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@ -Language CSharp

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [RawPrinter]::SendRawBytes($PrinterName, $bytes)
if ($ok) { Write-Host "OK:$($bytes.Length)" } else { Write-Host "FAIL"; exit 1 }
