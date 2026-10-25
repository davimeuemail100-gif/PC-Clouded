const express = require('express');
const https = require('https');
const app = express();

app.use(express.json({ limit: '50mb' }));

// CHECAGEM DE SEGURANÇA: Vai aparecer no Log da Vercel se as chaves estão lá
console.log("Client ID:", CLIENT_ID ? "OK" : "FALTANDO");
console.log("Client Secret:", CLIENT_SECRET ? "OK" : "FALTANDO");
console.log("Refresh Token:", REFRESH_TOKEN ? "OK" : "FALTANDO");

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Função que renova o token do Google
function renovarToken() {
    return new Promise((resolve, reject) => {
        const postData = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`;
        const options = {
            hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(postData) }
        };
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                const data = JSON.parse(body);
                if (data.access_token) resolve(data.access_token);
                else reject(data);
            });
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });
}

// Rota que salva no Google Drive
app.post('/api/salvar-no-drive', async (req, res) => {
    try {
        const { nomeArquivo, conteudoBase64 } = req.body;
        const accessToken = await renovarToken();

        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const metadata = { 'name': nomeArquivo };
        const multipartRequestBody =
            delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + 'Content-Type: text/plain\r\n' + 'Content-Transfer-Encoding: base64\r\n\r\n' + conteudoBase64 + close_delim;

        const options = {
            hostname: 'www.googleapis.com', path: '/upload/drive/v3/files?uploadType=multipart', method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
                'Content-Length': Buffer.byteLength(multipartRequestBody)
            }
        };

        const googleReq = https.request(options, (googleRes) => {
            let googleBody = '';
            googleRes.on('data', (chunk) => googleBody += chunk);
            googleRes.on('end', () => {
                if (googleRes.statusCode === 200) res.json({ status: "sucesso" });
                else res.status(500).json({ erro: googleBody });
            });
        });
        googleReq.write(multipartRequestBody);
        googleReq.end();
    } catch (erro) {
        res.status(500).json({ erro: "Falha no Token ou na conexão" });
    }
});

// A INTERFACE (Windows 11 Retrô com Tabelas)
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Windows 11 Web</title>
        <style>
            /* Cores do Win11, mas sem CSS moderno */
            body { background-color: #0067c0; margin: 0; font-family: Arial, sans-serif; overflow: hidden; height: 100vh; }
            #desktop { height: 90vh; padding: 20px; }
            
            /* Ícone da Área de Trabalho */
            .icone { width: 80px; text-align: center; color: #fff; cursor: pointer; display: inline-block; text-shadow: 1px 1px 2px #000; }
            .icone div { font-size: 40px; }
            .icone span { font-size: 13px; }

            /* Barra de Tarefas */
            #barra-tarefas { 
                position: absolute; bottom: 0; width: 100%; height: 10vh; 
                background-color: #f3f3f3; border-top: 1px solid #ccc; text-align: center;
            }
            #barra-tarefas table { width: 100%; height: 100%; }
            .icone-barra { font-size: 24px; color: #0067c0; cursor: pointer; padding: 0 15px; }
            #status { position: absolute; right: 20px; top: 30%; color: #333; font-size: 12px; font-weight: bold; }

            /* Janela */
            #janela { display: none; position: absolute; top: 20%; left: 25%; width: 50%; height: 50%; background-color: #fff; border: 2px solid #0067c0; z-index: 10; }
            #barra-titulo { background-color: #0067c0; color: #fff; padding: 10px; font-weight: bold; }
            #fechar { float: right; cursor: pointer; color: #fff; }
            #textarea { width: 95%; height: 60%; margin: 10px; outline: none; border: 1px solid #ccc; padding: 5px; }
            .btn-salvar { background-color: #0067c0; color: #fff; border: none; padding: 10px 20px; margin-left: 10px; cursor: pointer; font-weight: bold; }
        </style>
    </head>
    <body>
        <div id="desktop">
            <!-- Ícone -->
            <div class="icone" onclick="abrirBloco()">
                <div>📄</div>
                <span>MeuHD.txt</span>
            </div>
            
            <!-- Janela -->
            <div id="janela">
                <div id="barra-titulo">
                    <span id="fechar" onclick="fecharBloco()">X</span>
                    📄 Bloco de Notas
                </div>
                <textarea id="textarea" placeholder="Digite aqui. Salva direto no Google Drive..."></textarea>
                <button class="btn-salvar" onclick="salvarNoDrive()">Salvar na Nuvem</button>
            </div>
        </div>

        <!-- Barra de tarefas -->
        <div id="barra-tarefas">
            <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td align="center">
                        <span class="icone-barra">⊞</span>
                        <span class="icone-barra">🔍</span>
                        <span class="icone-barra">📁</span>
                    </td>
                </tr>
            </table>
            <div id="status">Conectado ao Drive</div>
        </div>

        <script>
            // Código ES5 (À prova de TVs)
            function abrirBloco() { document.getElementById('janela').style.display = 'block'; }
            function fecharBloco() { document.getElementById('janela').style.display = 'none'; }
            
            function salvarNoDrive() {
                var texto = document.getElementById('textarea').value;
                if(texto === "") { alert("Digite algo primeiro!"); return; }
                
                document.getElementById('status').innerText = "Enviando...";
                
                var xhr = new XMLHttpRequest();
                xhr.open("POST", "/api/salvar-no-drive", true);
                xhr.setRequestHeader("Content-Type", "application/json");
                
                xhr.onreadystatechange = function() {
                    if (xhr.readyState == 4) {
                        if(xhr.status == 200) {
                            document.getElementById('status').innerText = "Salvo no Drive!";
                            alert("Arquivo enviado pro Google Drive!");
                        } else {
                            document.getElementById('status').innerText = "Erro ao salvar";
                            alert("Erro. Verifique o token no Google.");
                        }
                    }
                };
                
                xhr.send(JSON.stringify({ 
                    nomeArquivo: "arquivo_salvo.txt", 
                    conteudoBase64: btoa(texto) 
                }));
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(3000, () => console.log("PC na Nuvem ligado!"));
