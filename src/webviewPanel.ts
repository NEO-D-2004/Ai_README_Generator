import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as xml2js from 'xml2js';
import { analyzeWorkspace } from './analyzer';
import { generateReadme, generateReadmeSection } from './generator';

const defaultJsonData = {
  tree: [
    {
      name: "src",
      type: "folder",
      children: [
        { name: "extension.ts", type: "file" },
        { name: "parser.ts", type: "file" }
      ]
    },
    {
      name: "media",
      type: "folder",
      children: [
        { name: "icon.svg", type: "file" }
      ]
    },
    {
      name: "README.md",
      type: "file"
    }
  ],
  table: [
    { file: "README.md", type: "MD", size: "4KB" },
    { file: "src/extension.ts", type: "TS", size: "12KB" },
    { file: "src/parser.ts", type: "TS", size: "8KB" },
    { file: "media/icon.svg", type: "SVG", size: "2KB" }
  ]
};

const defaultXmlData = `<project>
  <tree>
    <node name="src" type="folder">
      <node name="extension.ts" type="file" />
      <node name="parser.ts" type="file" />
    </node>
    <node name="media" type="folder">
      <node name="icon.svg" type="file" />
    </node>
    <node name="README.md" type="file" />
  </tree>
  <table>
    <row file="README.md" type="MD" size="4KB" />
    <row file="src/extension.ts" type="TS" size="12KB" />
    <row file="src/parser.ts" type="TS" size="8KB" />
    <row file="media/icon.svg" type="SVG" size="2KB" />
  </table>
</project>`;

function parseXmlTree(xmlNodes: any[]): any[] {
  if (!xmlNodes) { return []; }
  return xmlNodes.map(x => {
    const node: any = {
      name: x.$.name,
      type: x.$.type
    };
    if (x.node) {
      node.children = parseXmlTree(x.node);
    }
    return node;
  });
}

function transformXmlData(result: any): any {
  try {
    const treeNodes = result.project?.tree?.[0]?.node || [];
    const tree = parseXmlTree(treeNodes);

    const rows = result.project?.table?.[0]?.row || [];
    const table = rows.map((r: any) => ({
      file: r.$.file,
      type: r.$.type,
      size: r.$.size
    }));

    return { tree, table };
  } catch (e: any) {
    throw new Error(`Failed to parse XML schema: ${e.message}`);
  }
}

export class ReadmeGeneratorViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'ai-readme-generator-view';
  private _view?: vscode.WebviewView;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _secretStorage: vscode.SecretStorage
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'getApiKey': {
          const apiKey = (await this._secretStorage.get('NVIDIA_API_KEY')) || '';
          webviewView.webview.postMessage({ type: 'apiKeyResult', key: apiKey });
          break;
        }
        case 'saveApiKey': {
          await this._secretStorage.store('NVIDIA_API_KEY', data.key);
          vscode.window.showInformationMessage('NVIDIA API Key saved securely.');
          webviewView.webview.postMessage({ type: 'apiKeyResult', key: data.key });
          break;
        }
        case 'clearApiKey': {
          await this._secretStorage.delete('NVIDIA_API_KEY');
          vscode.window.showInformationMessage('NVIDIA API Key cleared.');
          webviewView.webview.postMessage({ type: 'apiKeyResult', key: '' });
          break;
        }
        case 'scanWorkspace': {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No active workspace folder found.');
            webviewView.webview.postMessage({ type: 'error', message: 'No workspace folder open.' });
            return;
          }

          webviewView.webview.postMessage({ type: 'status', message: 'Scanning workspace...' });
          try {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const result = await analyzeWorkspace(rootPath);
            webviewView.webview.postMessage({ type: 'scanResult', data: result });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Scan failed: ${err.message}`);
            webviewView.webview.postMessage({ type: 'error', message: err.message });
          }
          break;
        }
        case 'generateReadme': {
          webviewView.webview.postMessage({ type: 'status', message: 'Generating README with NVIDIA LLM...' });
          try {
            const apiKey = (await this._secretStorage.get('NVIDIA_API_KEY')) || data.options.apiKey;
            if (!apiKey) {
              throw new Error('NVIDIA API Key is missing. Please save it in the settings first.');
            }

            const readmeContent = await generateReadme({
              apiKey,
              model: data.options.model,
              temperature: data.options.temperature,
              maxTokens: data.options.maxTokens,
              metadata: data.options.metadata,
              sections: data.options.sections,
              customPrompt: data.options.customPrompt
            });

            webviewView.webview.postMessage({ type: 'readmeGenerated', content: readmeContent });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Generation failed: ${err.message}`);
            webviewView.webview.postMessage({ type: 'error', message: err.message });
          }
          break;
        }
        case 'regenerateSection': {
          webviewView.webview.postMessage({ type: 'status', message: `Regenerating section "${data.options.sectionName}"...` });
          try {
            const apiKey = (await this._secretStorage.get('NVIDIA_API_KEY')) || data.options.apiKey;
            if (!apiKey) {
              throw new Error('NVIDIA API Key is missing. Please save it in the settings first.');
            }

            const sectionContent = await generateReadmeSection({
              apiKey,
              model: data.options.model,
              temperature: data.options.temperature,
              maxTokens: data.options.maxTokens,
              metadata: data.options.metadata,
              sectionName: data.options.sectionName,
              existingReadme: data.options.existingReadme,
              customPrompt: data.options.customPrompt
            });

            webviewView.webview.postMessage({
              type: 'sectionRegenerated',
              sectionName: data.options.sectionName,
              content: sectionContent
            });
          } catch (err: any) {
            vscode.window.showErrorMessage(`Section regeneration failed: ${err.message}`);
            webviewView.webview.postMessage({ type: 'error', message: err.message });
          }
          break;
        }
        case 'saveReadme': {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No active workspace folder found to save.');
            return;
          }

          try {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const readmePath = path.join(rootPath, 'README.md');
            await fs.writeFile(readmePath, data.content, 'utf-8');
            vscode.window.showInformationMessage('README.md saved successfully!');
            
            // Open the file in editor
            const doc = await vscode.workspace.openTextDocument(readmePath);
            await vscode.window.showTextDocument(doc);
          } catch (err: any) {
            vscode.window.showErrorMessage(`Failed to save README: ${err.message}`);
          }
          break;
        }
        case 'loadExplorerData': {
          const workspaceFolders = vscode.workspace.workspaceFolders;
          if (!workspaceFolders || workspaceFolders.length === 0) {
            webviewView.webview.postMessage({ type: 'explorerDataError', message: 'No workspace folder open.' });
            return;
          }

          try {
            const rootPath = workspaceFolders[0].uri.fsPath;
            const dataDirPath = path.join(rootPath, 'data');
            const jsonFilePath = path.join(dataDirPath, 'sample-data.json');
            const xmlFilePath = path.join(dataDirPath, 'sample-data.xml');

            // 1. Ensure directory and files exist
            try {
              await fs.mkdir(dataDirPath, { recursive: true });
            } catch (e) {}

            try {
              await fs.access(jsonFilePath);
            } catch (e) {
              await fs.writeFile(jsonFilePath, JSON.stringify(defaultJsonData, null, 2), 'utf-8');
            }

            try {
              await fs.access(xmlFilePath);
            } catch (e) {
              await fs.writeFile(xmlFilePath, defaultXmlData, 'utf-8');
            }

            // 2. Read and parse based on format
            if (data.format === 'xml') {
              const xmlContent = await fs.readFile(xmlFilePath, 'utf-8');
              const parsedXml = await xml2js.parseStringPromise(xmlContent);
              const payload = transformXmlData(parsedXml);
              webviewView.webview.postMessage({ type: 'explorerDataResult', payload, format: 'xml' });
            } else {
              const jsonContent = await fs.readFile(jsonFilePath, 'utf-8');
              const payload = JSON.parse(jsonContent);
              webviewView.webview.postMessage({ type: 'explorerDataResult', payload, format: 'json' });
            }
          } catch (err: any) {
            webviewView.webview.postMessage({ type: 'explorerDataError', message: err.message });
          }
          break;
        }
        case 'showInfo': {
          vscode.window.showInformationMessage(data.message);
          break;
        }
        case 'showError': {
          vscode.window.showErrorMessage(data.message);
          break;
        }
      }
    });
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'out', 'webview', 'assets', 'index.css')
    );

    const nonce = getNonce();

    // CSP directive
    const cspSource = webview.cspSource;
    return `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src ${cspSource} https://integrate.api.nvidia.com;">
        <link href="${styleUri}" rel="stylesheet">
        <title>AI README Generator</title>
      </head>
      <body>
        <div id="root"></div>
        <script nonce="${nonce}" src="${scriptUri}"></script>
      </body>
      </html>`;
  }
}

function getNonce() {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

