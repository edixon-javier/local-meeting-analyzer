using System;
using System.Diagnostics;
using System.IO;
using System.Windows.Forms;

namespace LocalMeetingAnalyzer
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            try
            {
                string baseDir = AppDomain.CurrentDomain.BaseDirectory;
                string frontendDir = Path.Combine(baseDir, "frontend");
                string electronExe = Path.Combine(frontendDir, "node_modules", "electron", "dist", "electron.exe");

                // Verificar si existe el ejecutable empaquetado o el de desarrollo
                if (!File.Exists(electronExe))
                {
                    // Buscar en dist-electron si existe un ejecutable empaquetado
                    string distDir = Path.Combine(frontendDir, "dist-electron");
                    if (Directory.Exists(distDir))
                    {
                        string[] exeFiles = Directory.GetFiles(distDir, "*.exe");
                        if (exeFiles.Length > 0)
                        {
                            electronExe = exeFiles[0];
                        }
                    }
                }

                if (!File.Exists(electronExe))
                {
                    MessageBox.Show(
                        "No se encontró el ejecutable de la aplicación.\n\n" +
                        "Asegúrate de haber instalado las dependencias ejecutando 'npm install' en la carpeta frontend, " +
                        "o inicia la aplicación con 'start_dev.bat'.",
                        "Local Meeting Analyzer",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning
                    );
                    return;
                }

                // Verificar si la interfaz compilada existe
                string distIndex = Path.Combine(frontendDir, "dist", "index.html");
                if (!File.Exists(distIndex))
                {
                    // Compilar silenciosamente la interfaz si no existe
                    ProcessStartInfo buildInfo = new ProcessStartInfo
                    {
                        FileName = "cmd.exe",
                        Arguments = "/c npm run build",
                        WorkingDirectory = frontendDir,
                        CreateNoWindow = true,
                        UseShellExecute = false,
                        WindowStyle = ProcessWindowStyle.Hidden
                    };
                    Process buildProc = Process.Start(buildInfo);
                    if (buildProc != null)
                    {
                        buildProc.WaitForExit(30000);
                    }
                }

                // Preparar argumentos para Electron
                string extraArgs = string.Join(" ", args);
                string launchArgs = string.IsNullOrEmpty(extraArgs) ? "." : ". " + extraArgs;

                ProcessStartInfo startInfo = new ProcessStartInfo
                {
                    FileName = electronExe,
                    Arguments = launchArgs,
                    WorkingDirectory = frontendDir,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden
                };

                startInfo.EnvironmentVariables["NODE_ENV"] = "production";
                startInfo.EnvironmentVariables["EXTERNAL_BACKEND"] = "false";

                Process.Start(startInfo);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Ocurrió un error al iniciar Local Meeting Analyzer:\n\n" + ex.Message,
                    "Error de inicio",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
