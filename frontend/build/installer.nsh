; build/installer.nsh
; Incluido automáticamente por electron-builder en el instalador NSIS.
; Antes de instalar/actualizar o desinstalar, cierra el backend de Python si quedó abierto
; (p. ej. tras un cierre inesperado), para que meeting-backend.exe no bloquee los archivos.

!macro customInit
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /t /im meeting-backend.exe'
  Pop $0
!macroend

!macro customUnInit
  nsExec::Exec '"$SYSDIR\taskkill.exe" /f /t /im meeting-backend.exe'
  Pop $0
!macroend
