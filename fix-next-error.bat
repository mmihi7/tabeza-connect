@echo off
echo Fixing Next.js build error...
echo.

echo Step 1: Cleaning build cache...
cd apps\staff
if exist .next rmdir /s /q .next
cd ..\..

echo Step 2: Reinstalling dependencies...
pnpm install

echo.
echo ✅ Fixed! Now restart your dev server:
echo    pnpm dev:staff
echo.
pause
