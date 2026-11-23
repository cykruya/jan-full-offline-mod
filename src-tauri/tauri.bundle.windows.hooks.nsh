; Installs the Visual C++ runtime Jan and the llama.cpp engine link against,
; from the copy `yarn download:bin` puts in resources. Nothing is downloaded
; at install time.
!define VCREDIST "${__FILEDIR__}\resources\vc_redist.x64.exe"

!macro NSIS_HOOK_PREINSTALL
  ; Visual Studio 2015-2022 runtime, 14.0 or later.
  ReadRegStr $0 HKLM "SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Version"
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" "Version"
  ${EndIf}
  ${If} $0 == ""
    ReadRegStr $0 HKLM "SOFTWARE\Classes\Installer\Dependencies\Microsoft.VS.VC_RuntimeMinimumVSU_amd64,v14" "Version"
  ${EndIf}

  ${If} $0 == ""
    DetailPrint "Installing Visual C++ Redistributable..."
    File "/oname=$TEMP\vc_redist.x64.exe" "${VCREDIST}"
    ExecWait '"$TEMP\vc_redist.x64.exe" /quiet /norestart' $2
    Delete "$TEMP\vc_redist.x64.exe"
    ; 1638: a newer version is already installed. 3010: installed, restart pending.
    ${If} $2 != 0
    ${AndIf} $2 != 1638
    ${AndIf} $2 != 3010
      MessageBox MB_ICONEXCLAMATION|MB_YESNO "Visual C++ Redistributable installation failed. Continue anyway?" IDYES vcredist_done
      Abort "Installation cancelled due to Visual C++ Redistributable failure"
      vcredist_done:
    ${EndIf}
  ${Else}
    DetailPrint "Visual C++ Redistributable already installed (version: $0)"
  ${EndIf}
!macroend
