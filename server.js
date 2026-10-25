const express = require('express');
const https = require('https');
const app = express();

app.use(express.json({ limit: '50mb' }));

// Puxa as chaves do cofre da Vercel
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = process.env.GOOGLE_REFRESH_TOKEN;

// Função que a Vercel usa para renovar o token
function renovarToken() {
    return new Promise((resolve, reject) => {
        const postData = `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`;
        const options = {
            hostname: 'oauth2.googleapis.com',
            path: '/token',
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(postData)
            }
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

// ==========================================
// ROTA QUE SALVA NO GOOGLE DRIVE
// ==========================================
app.post('/api/salvar-no-drive', async (req, res) => {
    try {
        const { nomeArquivo, conteudoBase64 } = req.body;

        // 1. Pega o token novo
        const accessToken = await renovarToken();

        // 2. Prepara o arquivo pro Google
        const boundary = '-------314159265358979323846';
        const delimiter = "\r\n--" + boundary + "\r\n";
        const close_delim = "\r\n--" + boundary + "--";

        const metadata = { 'name': nomeArquivo };
        const multipartRequestBody =
            delimiter + 'Content-Type: application/json\r\n\r\n' + JSON.stringify(metadata) +
            delimiter + 'Content-Type: text/plain\r\n' + 'Content-Transfer-Encoding: base64\r\n\r\n' + conteudoBase64 + close_delim;

        const options = {
            hostname: 'www.googleapis.com',
            path: '/upload/drive/v3/files?uploadType=multipart',
            method: 'POST',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'multipart/related; boundary="' + boundary + '"',
                'Content-Length': Buffer.byteLength(multipartRequestBody)
            }
        };

        // 3. Manda pro Google
        const googleReq = https.request(options, (googleRes) => {
            let googleBody = '';
            googleRes.on('data', (chunk) => googleBody += chunk);
            googleRes.on('end', () => {
                if (googleRes.statusCode === 200) {
                    res.json({ status: "sucesso", mensagem: "Arquivo no Drive!" });
                } else {
                    res.status(500).json({ erro: googleBody });
                }
            });
        });

        googleReq.write(multipartRequestBody);
        googleReq.end();

    } catch (erro) {
        res.status(500).json({ erro: "Falha no Token ou na conexão" });
    }
});

// ==========================================
// A INTERFACE DO WINDOWS (O site da TV)
// ==========================================
app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Windows Web</title>
        <style>
            body { background-color: #008080; margin: 0; font-family: Arial; overflow: hidden; height: 100vh; }
            #desktop { height: 90vh; padding: 20px; position: relative; }
            .icone { width: 80px; text-align: center; color: white; cursor: pointer; display: inline-block; }
            .icone span { display: block; font-size: 14px; text-shadow: 1px 1px 1px #000; }
            #barra-tarefas { position: absolute; bottom: 0; width: 100%; height: 10vh; background-color: #c0c0c0; border-top: 2px solid #fff; display: flex; align-items: center; padding: 0 10px; box-sizing: border-box;}
            #botao-iniciar { padding: 5px 15px; background-color: #c0c0c0; border: 2px solid; border-color: #fff #000 #000 #fff; font-weight: bold; cursor: pointer;}
            
            #janela { display: none; position: absolute; top: 50px; left: 100px; width: 500px; height: 400px; background-color: #c0c0c0; border: 2px solid; border-color: #fff #000 #000 #fff; z-index: 10; flex-direction: column; }
            #barra-titulo { background-color: #000080; color: white; padding: 5px; font-weight: bold; display: flex; justify-content: space-between; }
            #fechar { cursor: pointer; padding: 0 5px; background-color: #c0c0c0; color: black; border: 1px solid; border-color: #fff #000 #000 #fff; }
            #textarea { flex: 1; margin: 5px; resize: none; outline: none; font-family: monospace; padding: 5px; }
            #status { position: absolute; bottom: 0; right: 10px; color: white; font-size: 12px; padding: 2px; }
        </style>
    </head>
    <body>
        <div id="desktop">
            <div class="icone" onclick="abrirBloco()">
                <div style="font-size: 48px;">📄</div>
                <span>MeuHD.txt</span>
            </div>
            <div id="janela">
                <div id="barra-titulo">
                    <span>MeuHD.txt - Bloco de Notas</span>
                    <span id="fechar" onclick="fecharBloco()">X</span>
                </div>
                <textarea id="textarea" placeholder="Digite aqui. Vai direto pro Google Drive!"></textarea>
                <div style="padding: 5px; text-align: right;">
                    <button onclick="salvarNoDrive()" style="padding: 5px 20px;">Salvar</button>
                </div>
            </div>
        </div>
        <div id="barra-tarefas">
            <div id="botao-iniciar">⊞ Iniciar</div>
            <div id="status">Conectado à Nuvem</div>
        </div>
        <script>
            function abrirBloco() { document.getElementById('janela').style.display = 'flex'; }
            function fecharBloco() { document.getElementById('janela').style.display = 'none'; }
            function salvarNoDrive() {
                var texto = document.getElementById('textarea').value;
                if(texto === "") return alert("Digite algo!");
                
                document.getElementById('status').innerText = "Enviando pro Google Drive...";
                
                fetch('/api/salvar-no-drive', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        nomeArquivo: "arquivo_salvo.txt",
                        conteudoBase64: btoa(texto) // Converte pra Base64
                    })
                })
                .then(res => res.json())
                .then(data => {
                    if(data.status === 'sucesso') {
                        document.getElementById('status').innerText = "Salvo no Drive!";
                        alert("Arquivo salvo no seu Google Drive!");
                    } else {
                        document.getElementById('status').innerText = "Erro ao salvar";
                    }
                });
            }
        </script>
    </body>
    </html>
    `);
});

app.listen(3000, () => console.log("PC na Nuvem rodando!"));
