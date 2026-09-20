Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
electronExe = currentDir & "\node_modules\electron\dist\electron.exe"

Set WshShell = CreateObject("WScript.Shell")

If fso.FileExists(electronExe) Then
    WshShell.Run """" & electronExe & """ """ & currentDir & """", 0, False
Else
    WshShell.Run "powershell -WindowStyle Hidden -Command ""npm run electron""", 0, False
End If

Set WshShell = Nothing
Set fso = Nothing
