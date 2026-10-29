// TerraIE.exe — janela do "Modo Internet Explorer" do navegador Terra da Luz.
//
// Usa o controle WebBrowser do .NET Framework, que é o motor MSHTML (Trident)
// do Internet Explorer 11 que continua presente no Windows 10 e 11 — o mesmo
// motor usado pelo modo IE do Microsoft Edge.
//
// Escrito em C# 5 para compilar com o csc.exe que já vem no Windows
// (C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe), sem instalar nada.
using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: System.Reflection.AssemblyTitle("Terra da Luz - Modo Internet Explorer")]
[assembly: System.Reflection.AssemblyProduct("Terra da Luz")]
[assembly: System.Reflection.AssemblyVersion("1.0.0.0")]

namespace TerraDaLuz
{
    static class Programa
    {
        [STAThread]
        static int Main(string[] args)
        {
            ConfigurarMotor();
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            string endereco = args.Length > 0 ? args[0] : "about:blank";
            Uri uri;
            if (!Uri.TryCreate(endereco, UriKind.Absolute, out uri) ||
                !(uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps ||
                  uri.Scheme == Uri.UriSchemeFile || endereco == "about:blank"))
            {
                MessageBox.Show("Endereço inválido para o modo Internet Explorer:\n" + endereco,
                    "Terra da Luz", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                return 1;
            }
            Application.Run(new JanelaIE(endereco));
            return 0;
        }

        // Faz o controle WebBrowser usar o modo de documento do IE 11 (o padrão
        // seria o IE 7) e liga a renderização por GPU. Fica só no registro do
        // usuário e só para este executável.
        static void ConfigurarMotor()
        {
            string exe = Path.GetFileName(Application.ExecutablePath);
            const string baseChave = @"Software\Microsoft\Internet Explorer\Main\FeatureControl\";
            Definir(baseChave + "FEATURE_BROWSER_EMULATION", exe, 11001);
            Definir(baseChave + "FEATURE_GPU_RENDERING", exe, 1);
            Definir(baseChave + "FEATURE_DISABLE_NAVIGATION_SOUNDS", exe, 1);
            Definir(baseChave + "FEATURE_96DPI_PIXEL", exe, 1);
            Definir(baseChave + "FEATURE_ENABLE_CLIPCHILDREN_OPTIMIZATION", exe, 1);
            Definir(baseChave + "FEATURE_RESTRICT_ABOUT_PROTOCOL_IE7", exe, 1);
            Definir(baseChave + "FEATURE_BLOCK_LMZ_SCRIPT", exe, 1);
        }

        static void Definir(string chave, string nome, int valor)
        {
            try
            {
                using (RegistryKey k = Registry.CurrentUser.CreateSubKey(chave))
                {
                    if (k != null) k.SetValue(nome, valor, RegistryValueKind.DWord);
                }
            }
            catch (Exception) { }
        }
    }

    class JanelaIE : Form
    {
        static readonly Color Anil = Color.FromArgb(27, 42, 94);
        static readonly Color Ambar = Color.FromArgb(246, 156, 74);
        static readonly Color Areia = Color.FromArgb(250, 246, 238);
        static readonly Color Borda = Color.FromArgb(231, 220, 203);

        readonly WebBrowser navegador = new WebBrowser();
        readonly TextBox barraEndereco = new TextBox();
        readonly Button voltar, avancar, recarregar, modoModerno;
        readonly Label selo = new Label();
        readonly Label status = new Label();
        readonly ProgressBar progresso = new ProgressBar();

        public JanelaIE(string endereco)
        {
            Text = "Terra da Luz — Modo Internet Explorer";
            Width = 1200;
            Height = 820;
            StartPosition = FormStartPosition.WindowsDefaultLocation;
            BackColor = Areia;
            Font = new Font("Segoe UI", 9.5f);
            try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch (Exception) { }

            // ---- barra superior ----
            Panel topo = new Panel();
            topo.Dock = DockStyle.Top;
            topo.Height = 52;
            topo.BackColor = Color.White;
            topo.Padding = new Padding(8, 9, 8, 9);
            topo.Paint += delegate(object s, PaintEventArgs e)
            {
                using (Pen p = new Pen(Borda)) e.Graphics.DrawLine(p, 0, topo.Height - 1, topo.Width, topo.Height - 1);
            };

            voltar = BotaoIcone("\uE72B", "Voltar");
            avancar = BotaoIcone("\uE72A", "Avançar");
            recarregar = BotaoIcone("\uE72C", "Recarregar");
            voltar.Click += delegate { if (navegador.CanGoBack) navegador.GoBack(); };
            avancar.Click += delegate { if (navegador.CanGoForward) navegador.GoForward(); };
            recarregar.Click += delegate { navegador.Refresh(WebBrowserRefreshOption.Completely); };

            selo.Text = "  Modo IE  ";
            selo.AutoSize = true;
            selo.BackColor = Ambar;
            selo.ForeColor = Color.White;
            selo.Font = new Font("Segoe UI Semibold", 9f);
            selo.Padding = new Padding(6, 6, 6, 6);
            selo.Margin = new Padding(6, 2, 6, 0);
            new ToolTip().SetToolTip(selo, "Esta janela usa o motor do Internet Explorer 11 para sites antigos.");

            barraEndereco.BorderStyle = BorderStyle.FixedSingle;
            barraEndereco.Font = new Font("Segoe UI", 11f);
            barraEndereco.KeyDown += delegate(object s, KeyEventArgs e)
            {
                if (e.KeyCode == Keys.Enter)
                {
                    e.SuppressKeyPress = true;
                    Navegar(barraEndereco.Text.Trim());
                }
            };

            modoModerno = new Button();
            modoModerno.Text = "Abrir no modo moderno";
            modoModerno.FlatStyle = FlatStyle.Flat;
            modoModerno.FlatAppearance.BorderSize = 0;
            modoModerno.BackColor = Anil;
            modoModerno.ForeColor = Color.White;
            modoModerno.Font = new Font("Segoe UI Semibold", 9.5f);
            modoModerno.AutoSize = true;
            modoModerno.Padding = new Padding(10, 2, 10, 2);
            modoModerno.Cursor = Cursors.Hand;
            modoModerno.Click += delegate { AbrirNoModoModerno(); };

            TableLayoutPanel linha = new TableLayoutPanel();
            linha.Dock = DockStyle.Fill;
            linha.ColumnCount = 6;
            linha.RowCount = 1;
            for (int i = 0; i < 4; i++) linha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            linha.ColumnStyles.Add(new ColumnStyle(SizeType.Percent, 100f));
            linha.ColumnStyles.Add(new ColumnStyle(SizeType.AutoSize));
            linha.Controls.Add(voltar, 0, 0);
            linha.Controls.Add(avancar, 1, 0);
            linha.Controls.Add(recarregar, 2, 0);
            linha.Controls.Add(selo, 3, 0);
            barraEndereco.Dock = DockStyle.Fill;
            barraEndereco.Margin = new Padding(4, 3, 8, 0);
            linha.Controls.Add(barraEndereco, 4, 0);
            linha.Controls.Add(modoModerno, 5, 0);
            topo.Controls.Add(linha);

            // ---- aviso ----
            Panel aviso = new Panel();
            aviso.Dock = DockStyle.Top;
            aviso.Height = 30;
            aviso.BackColor = Color.FromArgb(255, 241, 214);
            Label textoAviso = new Label();
            textoAviso.Dock = DockStyle.Fill;
            textoAviso.TextAlign = ContentAlignment.MiddleLeft;
            textoAviso.Padding = new Padding(12, 0, 0, 0);
            textoAviso.ForeColor = Color.FromArgb(110, 70, 10);
            textoAviso.Text = "Use o modo Internet Explorer só para sistemas antigos em que você confia. Para o resto da internet, use o modo moderno.";
            aviso.Controls.Add(textoAviso);

            // ---- rodapé ----
            Panel rodape = new Panel();
            rodape.Dock = DockStyle.Bottom;
            rodape.Height = 24;
            rodape.BackColor = Color.White;
            status.Dock = DockStyle.Fill;
            status.TextAlign = ContentAlignment.MiddleLeft;
            status.Padding = new Padding(8, 0, 0, 0);
            status.ForeColor = Color.FromArgb(91, 98, 116);
            progresso.Dock = DockStyle.Right;
            progresso.Width = 160;
            progresso.Visible = false;
            rodape.Controls.Add(status);
            rodape.Controls.Add(progresso);

            // ---- motor ----
            navegador.Dock = DockStyle.Fill;
            navegador.ScriptErrorsSuppressed = true;
            navegador.IsWebBrowserContextMenuEnabled = true;
            navegador.WebBrowserShortcutsEnabled = true;
            navegador.AllowWebBrowserDrop = false;
            navegador.Navigated += delegate(object s, WebBrowserNavigatedEventArgs e)
            {
                barraEndereco.Text = e.Url.ToString();
                AtualizarBotoes();
                status.Text = e.Url.Scheme == "https" ? "🔒 Conexão segura" : (e.Url.Scheme == "http" ? "Conexão sem cadeado" : "");
            };
            navegador.DocumentTitleChanged += delegate
            {
                string t = navegador.DocumentTitle;
                Text = (string.IsNullOrEmpty(t) ? "" : t + " — ") + "Terra da Luz (Modo Internet Explorer)";
            };
            navegador.ProgressChanged += delegate(object s, WebBrowserProgressChangedEventArgs e)
            {
                if (e.MaximumProgress > 0 && e.CurrentProgress >= 0 && e.CurrentProgress < e.MaximumProgress)
                {
                    progresso.Visible = true;
                    progresso.Value = (int)Math.Min(100, e.CurrentProgress * 100 / e.MaximumProgress);
                }
                else progresso.Visible = false;
            };
            navegador.CanGoBackChanged += delegate { AtualizarBotoes(); };
            navegador.CanGoForwardChanged += delegate { AtualizarBotoes(); };
            navegador.NewWindow += delegate(object s, System.ComponentModel.CancelEventArgs e)
            {
                // Janelas novas (pop-ups) abrem em outra janela do modo IE.
                e.Cancel = true;
                string destino = navegador.StatusText;
                Uri u;
                if (Uri.TryCreate(destino, UriKind.Absolute, out u) && (u.Scheme == "http" || u.Scheme == "https"))
                    new JanelaIE(u.ToString()).Show();
                else
                    status.Text = "Uma janela pop-up foi bloqueada.";
            };

            Controls.Add(navegador);
            Controls.Add(aviso);
            Controls.Add(topo);
            Controls.Add(rodape);

            AtualizarBotoes();
            Shown += delegate { Navegar(endereco); };
        }

        Button BotaoIcone(string glifo, string dica)
        {
            Button b = new Button();
            b.Text = glifo;
            b.Font = new Font("Segoe MDL2 Assets", 11f);
            b.Width = 36;
            b.Height = 32;
            b.FlatStyle = FlatStyle.Flat;
            b.FlatAppearance.BorderSize = 0;
            b.BackColor = Color.White;
            b.Cursor = Cursors.Hand;
            b.Margin = new Padding(0, 0, 2, 0);
            new ToolTip().SetToolTip(b, dica);
            return b;
        }

        void AtualizarBotoes()
        {
            voltar.Enabled = navegador.CanGoBack;
            avancar.Enabled = navegador.CanGoForward;
        }

        void Navegar(string texto)
        {
            if (string.IsNullOrEmpty(texto)) return;
            if (texto.IndexOf("://", StringComparison.Ordinal) < 0 && texto != "about:blank") texto = "http://" + texto;
            Uri u;
            if (!Uri.TryCreate(texto, UriKind.Absolute, out u)) return;
            if (u.Scheme != "http" && u.Scheme != "https" && u.Scheme != "file" && texto != "about:blank")
            {
                status.Text = "Endereço não permitido no modo IE.";
                return;
            }
            navegador.Navigate(u);
        }

        // Abre a página atual no navegador Terra da Luz (Chromium).
        void AbrirNoModoModerno()
        {
            string endereco = navegador.Url != null ? navegador.Url.ToString() : barraEndereco.Text;
            string pasta = Path.GetDirectoryName(Application.ExecutablePath);
            string[] candidatos = {
                Path.Combine(pasta, @"..\Application\chrome.exe"),
                Path.Combine(pasta, @"..\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), @"TerraDaLuz\Application\chrome.exe"),
                Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"TerraDaLuz\Application\chrome.exe")
            };
            foreach (string c in candidatos)
            {
                if (File.Exists(c))
                {
                    ProcessStartInfo psi = new ProcessStartInfo(Path.GetFullPath(c));
                    psi.Arguments = "\"" + endereco.Replace("\"", "%22") + "\"";
                    psi.UseShellExecute = false;
                    Process.Start(psi);
                    return;
                }
            }
            MessageBox.Show("Não encontrei o Terra da Luz instalado.", "Terra da Luz", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }
    }
}
