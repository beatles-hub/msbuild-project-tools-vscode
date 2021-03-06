import * as vscode from 'vscode';
import { Settings, NuGetSettings, readVSCodeSettings, VSCodeSettings } from './settings';

let extensionContext: vscode.ExtensionContext;
let extensionStatusBarItem: vscode.StatusBarItem;

/**
 * Register the extension's commands.
 * 
 * @param context The current extension context.
 */
export function registerCommands(context: vscode.ExtensionContext, statusBarItem: vscode.StatusBarItem): void
{
    extensionContext = context;
    extensionStatusBarItem = statusBarItem;

    extensionContext.subscriptions.push(
        vscode.commands.registerCommand('msbuildProjectTools.toggleNuGetPreRelease', toggleNuGetPreRelease)
    );
}

/**
 * Toggle filtering of NuGet pre-release packages and package versions.
 */
async function toggleNuGetPreRelease(): Promise<void> {
    const configuration = vscode.workspace.getConfiguration();
    
    // Toggle
    const includePreRelease = !configuration.get<boolean>('msbuildProjectTools.nuget.includePreRelease');

    await configuration.update('msbuildProjectTools.nuget.includePreRelease', includePreRelease);

    if (includePreRelease)
        extensionStatusBarItem.text = '$(check) NuGet: Pre-release enabled';
    else
        extensionStatusBarItem.text = '$(circle-slash) NuGet: Pre-release disabled';

    extensionStatusBarItem.show();

    setTimeout(() => {
        try {
            extensionStatusBarItem.hide();
        } catch (e) {
            // Proxy disposed; nothing to do
        }
    }, 800);
}
