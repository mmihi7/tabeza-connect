@echo off  
echo Deleting TabezaConnect registry keys...  
reg delete "HKLM\SOFTWARE\Tabeza\TabezaConnect" /f  
if 0 equ 0 (echo Registry keys deleted successfully) else (echo Failed to delete registry keys - make sure you run as Administrator)  
pause 
