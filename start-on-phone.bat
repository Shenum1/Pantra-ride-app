@echo off
echo Starting Pantra Ride App...
echo.
echo Make sure your phone and PC are on the same WiFi network.
echo Then scan the QR code that appears below with Expo Go.
echo.
cd /d "%~dp0"
set EXPO_NO_DOCTOR=1
node_modules\.bin\expo start --tunnel
pause
