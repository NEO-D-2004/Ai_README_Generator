import * as vscode from 'vscode';
import { ReadmeGeneratorViewProvider } from './webviewPanel';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ReadmeGeneratorViewProvider(context.extensionUri, context.secrets);

  // Register Webview View Provider
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ReadmeGeneratorViewProvider.viewType,
      provider
    )
  );

  // Command to open the generator panel
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-readme-generator.generate', () => {
      vscode.commands.executeCommand('workbench.view.extension.ai-readme-generator-sidebar');
    })
  );

  // Command to clear the NVIDIA API key from SecretStorage
  context.subscriptions.push(
    vscode.commands.registerCommand('ai-readme-generator.clearApiKey', async () => {
      await context.secrets.delete('NVIDIA_API_KEY');
      vscode.window.showInformationMessage('NVIDIA API Key has been cleared from secure storage.');
    })
  );
}

export function deactivate() {}
