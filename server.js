const express = require('express');
const https = require('https');
const app = express();

app.use(express.json({ limit: '50mb' }));

// 1. PRIMEIRO: Declara as variáveis puxando da Vercel
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
                else res.status(500).json({ erro: "Erro no Upload: " + googleBody });
            });
        });
        googleReq.write(multipartRequestBody);
        googleReq.end();
    } catch (erro) {
        res.status(500).json({ erro: "Erro no Token: " + JSON.stringify(erro) });
    }
});

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Windows 11 Web</title>
        <style>
            body { 
                background: linear-gradient(135deg, #004e92, #000428); 
                margin: 0; font-family: 'Segoe UI', Arial, sans-serif; 
                overflow: hidden; height: 100vh; color: #fff;
            }
            
            #desktop { height: calc(100vh - 50px); padding: 20px; position: relative; }
            
            .icone { width: 90px; text-align: center; cursor: pointer; display: inline-block; padding: 10px; border-radius: 8px; transition: 0.2s; }
            .icone:hover { background-color: rgba(255,255,255,0.1); }
            .icone div { font-size: 45px; line-height: 1; margin-bottom: 5px; text-shadow: 0 2px 5px rgba(0,0,0,0.5); }
            .icone span { font-size: 14px; text-shadow: 1px 1px 3px black; }

            #barra-tarefas { 
                position: absolute; bottom: 0; width: 100%; height: 50px; 
                background: rgba(32, 32, 32, 0.7); 
                backdrop-filter: blur(20px);
                display: flex; justify-content: center; align-items: center; 
                border-top: 1px solid rgba(255,255,255,0.1);
            }
            .icone-barra { font-size: 24px; color: #fff; cursor: pointer; padding: 0 15px; transition: 0.2s; }
            .icone-barra:hover { background: rgba(255,255,255,0.1); border-radius: 5px; }
            #status { position: absolute; right: 20px; color: #aaa; font-size: 12px; }

            #janela { 
                display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%);
                width: 500px; height: 400px; 
                background: rgba(243, 243, 243, 0.95); 
                backdrop-filter: blur(30px);
                border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
                z-index: 10; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.2);
                color: #000;
            }
            #barra-titulo { 
                background: rgba(255,255,255,0.5); color: #000; padding: 10px 15px; font-weight: 600; 
                display: flex; justify-content: space-between; align-items: center; 
                border-bottom: 1px solid #ddd;
            }
            #fechar { cursor: pointer; padding: 0 10px; color: #000; font-weight: bold; }
            #fechar:hover { background: red; color: white; border-radius: 3px; }
            #textarea { 
                flex: 1; margin: 0; border: none; resize: none; outline: none; 
                padding: 15px; font-family: 'Segoe UI', sans-serif; font-size: 15px; background: transparent;
            }
            .btn-salvar { 
                background: #0067c0; color: white; border: none; padding: 12px; 
                font-weight: bold; cursor: pointer; margin: 15px; border-radius: 6px;
            }
        </style>
    </head>
    <body>
        <div id="desktop">
            <div class="icone" onclick="abrirBloco()">
                <div>📄</div>
                <span>MeuHD.txt</span>
            </div>
            
            <div id="janela">
                <div id="barra-titulo">
                    <span>📄 MeuHD.txt - Bloco de Notas</span>
                    <span id="fechar" onclick="fecharBloco()">X</span>
                </div>
                <textarea id="textarea" placeholder="Digite aqui. Salva direto no Google Drive..."></textarea>
                <button class="btn-salvar" onclick="salvarNoDrive()">Salvar na Nuvem</button>
            </div>
        </div>

        <div id="barra-tarefas">
            <div class="icone-barra">⊞</div>
            <div class="icone-barra">🔍</div>
            <div class="icone-barra">📁</div>
            <div id="status">Conectado ao Drive</div>
        </div>

        <script>
            function abrirBloco() { document.getElementById('janela').style.display = 'flex'; }
            function fecharBloco() { document.getElementById('janela').style.display = 'none'; }
            
            function salvarNoDrive() {
                var texto = document.getElementById('textarea').value;
                if(texto === "") return alert("Digite algo primeiro!");
                
                document.getElementById('status').innerText = "Enviando...";
                
                fetch('/api/salvar-no-drive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nomeArquivo: "arquivo_salvo.txt",
                        conteudoBase64: btoa(texto)
                    })
                })
                .then(function(res) {
                    return res.text().then(function(text) {
                        try { return JSON.parse(text); } 
                        catch (e) { return { erro: "Erro na Vercel: " + text }; }
                    });
                })
                .then(function(data) {
                    if(data.status === 'sucesso') {
                        document.getElementById('status').innerText = "Salvo no Drive!";
                        alert("Arquivo enviado pro Google Drive!");
                    } else {
                        document.getElementById('status').innerText = "Erro";
                        alert(data.erro || "Erro desconhecido");
                    }
                })
                .catch(function(err) {
                    document.getElementById('status').innerText = "Erro de Rede";
                    alert("Falha na conexão: " + err.message);
                });
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(3000, () => console.log("PC na Nuvem ligado!"));
