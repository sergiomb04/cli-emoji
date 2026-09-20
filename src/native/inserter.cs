using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Threading;
using System.Windows.Forms;

namespace EmojiInserter
{
    class Program
    {
        [DllImport("user32.dll")]
        static extern bool SetForegroundWindow(IntPtr hWnd);

        [DllImport("user32.dll")]
        static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll")]
        static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);

        [DllImport("user32.dll", SetLastError = true)]
        static extern uint RegisterClipboardFormat(string lpszFormat);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool OpenClipboard(IntPtr hWndNewOwner);

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool CloseClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        static extern bool EmptyClipboard();

        [DllImport("user32.dll", SetLastError = true)]
        static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern IntPtr GlobalLock(IntPtr hMem);

        [DllImport("kernel32.dll", SetLastError = true)]
        static extern bool GlobalUnlock(IntPtr hMem);

        const uint GMEM_MOVEABLE = 0x0002;
        const uint CF_UNICODETEXT = 13;
        const byte VK_CONTROL = 0x11;
        const byte VK_V = 0x56;
        const uint KEYEVENTF_KEYUP = 0x0002;

        [STAThread]
        static void Main(string[] args)
        {
            if (args.Length == 0) return;

            if (args[0] == "--get-active")
            {
                IntPtr fg = GetForegroundWindow();
                Console.WriteLine(fg.ToInt64());
                return;
            }

            string emoji = "";
            IntPtr targetHwnd = IntPtr.Zero;

            if (args.Length >= 2)
            {
                long hwndLong = 0;
                long.TryParse(args[0], out hwndLong);
                targetHwnd = new IntPtr(hwndLong);
                emoji = args[1];
            }
            else
            {
                emoji = args[0];
            }

            if (string.IsNullOrEmpty(emoji)) return;

            // 1. Restaurar la ventana previa si tenemos el HWND
            if (targetHwnd != IntPtr.Zero)
            {
                SetForegroundWindow(targetHwnd);
                Thread.Sleep(50);
            }

            // 2. Guardar el portapapeles actual para restaurarlo después
            string previousText = null;
            try
            {
                if (Clipboard.ContainsText())
                {
                    previousText = Clipboard.GetText();
                }
            }
            catch { }

            // 3. Escribir el emoji en el portapapeles con formato CanIncludeInClipboardHistory = 0
            // Esto EVITA que Windows 10/11 lo guarde en el historial de Win+V
            bool copied = SetClipboardWithoutHistory(emoji);
            if (!copied)
            {
                // Fallback estándar
                try { Clipboard.SetText(emoji); } catch { }
            }

            Thread.Sleep(30);

            // 4. Simular Ctrl + V para pegar el emoji directamente
            keybd_event(VK_CONTROL, 0, 0, 0);
            keybd_event(VK_V, 0, 0, 0);
            keybd_event(VK_V, 0, KEYEVENTF_KEYUP, 0);
            keybd_event(VK_CONTROL, 0, KEYEVENTF_KEYUP, 0);

            // 5. Restaurar el portapapeles original tras pegar para que el usuario no pierda lo que tenía
            new Thread(() =>
            {
                Thread.Sleep(150);
                try
                {
                    if (previousText != null)
                    {
                        Clipboard.SetText(previousText);
                    }
                    else
                    {
                        Clipboard.Clear();
                    }
                }
                catch { }
            }).Start();
        }

        static bool SetClipboardWithoutHistory(string text)
        {
            if (!OpenClipboard(IntPtr.Zero)) return false;
            try
            {
                EmptyClipboard();

                // 1. Texto Unicode (el emoji)
                byte[] textBytes = System.Text.Encoding.Unicode.GetBytes(text + "\0");
                IntPtr hText = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)textBytes.Length);
                if (hText != IntPtr.Zero)
                {
                    IntPtr pText = GlobalLock(hText);
                    Marshal.Copy(textBytes, 0, pText, textBytes.Length);
                    GlobalUnlock(hText);
                    SetClipboardData(CF_UNICODETEXT, hText);
                }

                // 2. CanIncludeInClipboardHistory = 0 (Evita contaminación de Win+V)
                uint formatHistory = RegisterClipboardFormat("CanIncludeInClipboardHistory");
                if (formatHistory != 0)
                {
                    IntPtr hHistory = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)4);
                    if (hHistory != IntPtr.Zero)
                    {
                        IntPtr pHistory = GlobalLock(hHistory);
                        Marshal.WriteInt32(pHistory, 0); // 0 = false
                        GlobalUnlock(hHistory);
                        SetClipboardData(formatHistory, hHistory);
                    }
                }

                // 3. CanUploadToCloudClipboard = 0 (Evita sincronización en nube)
                uint formatCloud = RegisterClipboardFormat("CanUploadToCloudClipboard");
                if (formatCloud != 0)
                {
                    IntPtr hCloud = GlobalAlloc(GMEM_MOVEABLE, (UIntPtr)4);
                    if (hCloud != IntPtr.Zero)
                    {
                        IntPtr pCloud = GlobalLock(hCloud);
                        Marshal.WriteInt32(pCloud, 0); // 0 = false
                        GlobalUnlock(hCloud);
                        SetClipboardData(formatCloud, hCloud);
                    }
                }

                return true;
            }
            finally
            {
                CloseClipboard();
            }
        }
    }
}
