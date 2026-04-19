"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeepseekViewProvider = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class DeepseekViewProvider {
    _extensionUri;
    static viewType = 'deepseekChatView';
    _view;
    history = [];
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, _context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };
        webviewView.webview.html = this.getHtml(webviewView.webview);
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'sendMessage': {
                    const userMessage = data.value;
                    this.history.push({ role: 'user', content: userMessage });
                    webviewView.webview.postMessage({ type: 'thinking' });
                    const reply = await this.callOllamaAPI();
                    if (reply !== null) {
                        this.history.push({ role: 'assistant', content: reply });
                        webviewView.webview.postMessage({ type: 'response', value: reply });
                    }
                    else {
                        webviewView.webview.postMessage({ type: 'error', value: 'Request failed. See notification.' });
                    }
                    break;
                }
                case 'clear': {
                    this.clearConversation();
                    break;
                }
            }
        });
    }
    clearConversation() {
        this.history = [];
        this._view?.webview.postMessage({ type: 'cleared' });
    }
    async callOllamaAPI() {
        const config = vscode.workspace.getConfiguration('deepseek');
        const baseUrl = (config.get('ollamaUrl') || 'http://localhost:11434').replace(/\/$/, '');
        const model = config.get('model') || 'qwen2.5-coder:7b';
        const temperature = config.get('temperature') ?? 0.7;
        const systemPrompt = {
            role: 'system',
            content: 'You are a helpful, concise coding assistant embedded in VS Code. Prefer code blocks with language tags. Keep explanations short.'
        };
        try {
            const response = await axios_1.default.post(`${baseUrl}/v1/chat/completions`, {
                model,
                messages: [systemPrompt, ...this.history],
                stream: false,
                temperature
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 120000
            });
            return response.data.choices[0].message.content;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('ECONNREFUSED') || message.includes('connect')) {
                vscode.window.showErrorMessage('Ollama is not running. Start it with: ollama serve');
            }
            else {
                vscode.window.showErrorMessage(`Ollama error: ${message}`);
            }
            return null;
        }
    }
    getHtml(webview) {
        const nonce = getNonce();
        const csp = `default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';`;
        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>DeepSeek Chat</title>
<style>
    html, body { height: 100%; margin: 0; padding: 0; }
    body {
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-sideBar-background);
        display: flex;
        flex-direction: column;
    }
    #toolbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 10px;
        border-bottom: 1px solid var(--vscode-panel-border);
        font-size: 12px;
    }
    #toolbar button {
        background: transparent;
        color: var(--vscode-foreground);
        border: 1px solid var(--vscode-panel-border);
        padding: 2px 8px;
        font-size: 11px;
        cursor: pointer;
        border-radius: 3px;
    }
    #toolbar button:hover { background: var(--vscode-toolbar-hoverBackground); }
    #messages {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        font-size: 13px;
        line-height: 1.5;
    }
    .message { margin-bottom: 12px; white-space: pre-wrap; word-wrap: break-word; }
    .role {
        font-size: 11px;
        text-transform: uppercase;
        opacity: 0.7;
        margin-bottom: 3px;
        font-weight: 600;
    }
    .user .role { color: var(--vscode-textLink-foreground); }
    .assistant .role { color: var(--vscode-terminal-ansiGreen); }
    .error .role { color: var(--vscode-errorForeground); }
    .content pre {
        background: var(--vscode-textCodeBlock-background);
        padding: 8px;
        border-radius: 4px;
        overflow-x: auto;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
    }
    .content code {
        background: var(--vscode-textCodeBlock-background);
        padding: 1px 4px;
        border-radius: 3px;
        font-family: var(--vscode-editor-font-family);
        font-size: 12px;
    }
    #thinking { font-style: italic; opacity: 0.7; display: none; padding: 0 10px 6px; font-size: 12px; }
    #input-wrap {
        border-top: 1px solid var(--vscode-panel-border);
        padding: 8px;
        display: flex;
        gap: 6px;
    }
    #input {
        flex: 1;
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        padding: 6px 8px;
        font-family: var(--vscode-font-family);
        font-size: 13px;
        resize: vertical;
        min-height: 36px;
        max-height: 160px;
        border-radius: 3px;
    }
    #send {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
        border: none;
        padding: 6px 14px;
        cursor: pointer;
        border-radius: 3px;
        font-size: 13px;
    }
    #send:hover { background: var(--vscode-button-hoverBackground); }
    #send:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
</head>
<body>
    <div id="toolbar">
        <span>Ollama</span>
        <button id="clear-btn" title="Clear conversation">Clear</button>
    </div>
    <div id="messages"></div>
    <div id="thinking">Thinking…</div>
    <div id="input-wrap">
        <textarea id="input" rows="2" placeholder="Ask anything… (Shift+Enter for newline)"></textarea>
        <button id="send">Send</button>
    </div>
<script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const messagesEl = document.getElementById('messages');
    const input = document.getElementById('input');
    const sendBtn = document.getElementById('send');
    const clearBtn = document.getElementById('clear-btn');
    const thinking = document.getElementById('thinking');

    function escapeHtml(s) {
        return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    }
    function renderMarkdown(text) {
        let out = escapeHtml(text);
        out = out.replace(/\`\`\`([\\w-]*)\\n([\\s\\S]*?)\`\`\`/g, (_, lang, code) => '<pre><code>' + code + '</code></pre>');
        out = out.replace(/\`([^\`\\n]+)\`/g, '<code>$1</code>');
        return out;
    }
    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = 'message ' + role;
        const roleEl = document.createElement('div');
        roleEl.className = 'role';
        roleEl.textContent = role === 'user' ? 'You' : role === 'assistant' ? 'Ollama' : 'Error';
        const content = document.createElement('div');
        content.className = 'content';
        content.innerHTML = renderMarkdown(text);
        div.appendChild(roleEl);
        div.appendChild(content);
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    }
    function send() {
        const text = input.value.trim();
        if (!text) return;
        addMessage('user', text);
        vscode.postMessage({ type: 'sendMessage', value: text });
        input.value = '';
        sendBtn.disabled = true;
    }
    sendBtn.addEventListener('click', send);
    clearBtn.addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            send();
        }
    });
    window.addEventListener('message', e => {
        const msg = e.data;
        if (msg.type === 'response') {
            thinking.style.display = 'none';
            addMessage('assistant', msg.value);
            sendBtn.disabled = false;
            input.focus();
        } else if (msg.type === 'thinking') {
            thinking.style.display = 'block';
        } else if (msg.type === 'error') {
            thinking.style.display = 'none';
            addMessage('error', msg.value);
            sendBtn.disabled = false;
        } else if (msg.type === 'cleared') {
            messagesEl.innerHTML = '';
            thinking.style.display = 'none';
            sendBtn.disabled = false;
        }
    });
</script>
</body>
</html>`;
    }
}
exports.DeepseekViewProvider = DeepseekViewProvider;
function getNonce() {
    let text = '';
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return text;
}
//# sourceMappingURL=deepseekViewProvider.js.map