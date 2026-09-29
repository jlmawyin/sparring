# Despliegue FTPS de Sparring

La aplicación usa dos grupos de secretos separados:

- `.env`: configuración de ejecución local, incluida `ASSEMBLYAI_API_KEY`.
- `.secrets/`: credenciales locales de despliegue, cifradas con DPAPI y excluidas de Git.

## Guardar la contraseña sin enviarla por chat

Desde la raíz del proyecto, en PowerShell:

```powershell
.\scripts\secretos.ps1 -Guardar SPARRING_FTP_USER
.\scripts\secretos.ps1 -Guardar SPARRING_FTP_PASS
```

La consola solicita la contraseña de forma oculta. Para cargarla sólo en la sesión actual:

```powershell
. .\scripts\secretos.ps1 -Cargar
```

No se deben imprimir `$env:SPARRING_FTP_PASS`, incluirlo en comandos guardados, ni subir `.secrets/`.

## Parámetros de BanaHosting

```text
FTP_HOST=ftp.mawyin.net
FTP_TLS_HOST=single-2030.banahosting.com
FTP_PORT=21
FTP_MODE=explicit TLS
FTP_USER=(cargado desde DPAPI local)
PUBLIC_URL=https://sparring.visitaremota.com
```

La conexión debe usar FTPS explícito con `--ssl-reqd`, validar el certificado y no usar `--insecure`. El nombre `single-2030.banahosting.com` es el del certificado compartido del servidor; `ftp.mawyin.net` es el endpoint histórico de la cuenta.

La raíz de cada cuenta FTP puede ser distinta. Antes de publicar el build se debe subir un archivo de prueba con nombre único, comprobarlo por HTTPS y eliminarlo. No borrar `cgi-bin` ni `.well-known`.

La prueba controlada se ejecuta así, después de guardar `SPARRING_FTP_USER` y `SPARRING_FTP_PASS`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\ftp-probe.ps1
```

El script sube un marcador temporal, comprueba `https://sparring.visitaremota.com`, lo elimina y borra la contraseña del entorno del proceso. No publica `dist/`.

## Subir el build estático

Cuando la prueba anterior pasa, el build se puede publicar con:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\deploy-ftps.ps1
```

El script compila, rechaza claves/tokens, direcciones locales y mapas de código, sube sólo `dist/` y comprueba la raíz HTTPS. El backend local de Sparring sigue requiriendo un despliegue compatible separado.

Este procedimiento sólo resuelve la transferencia de archivos. El adaptador HTTP actual de Sparring es local y no debe publicarse en producción sin un backend compatible.
