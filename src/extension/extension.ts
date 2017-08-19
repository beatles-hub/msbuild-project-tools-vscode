'use strict';

import { default as axios } from 'axios';
import * as path from 'path';
import * as semver from 'semver';
import * as vscode from 'vscode';
import { LanguageClient, ServerOptions, LanguageClientOptions, ErrorAction, CloseAction } from 'vscode-languageclient';

import * as dotnet from './utils/dotnet';
import * as executables from './utils/executables';
import { PackageReferenceCompletionProvider, getNuGetV3AutoCompleteEndPoints } from './providers/package-reference-completion';

/**
 * Enable the MSBuild language service?
 */
let enableLanguageService = false;

let outputChannel: vscode.OutputChannel;

/**
 * Called when the extension is activated.
 * 
 * @param context The extension context.
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
    const progressOptions: vscode.ProgressOptions = {
        location: vscode.ProgressLocation.Window
    };
    await vscode.window.withProgress(progressOptions, async progress => {
        progress.report({
            message: 'Initialising MSBuild project tools...'
        });

        loadConfiguration();
    
        let canEnableLanguageService: boolean;
        if (enableLanguageService) {
            const dotnetVersion = await dotnet.getVersion();
            canEnableLanguageService = dotnetVersion && semver.gte(dotnetVersion, '2.0.0');
        }
    
        if (canEnableLanguageService && enableLanguageService) {
            const languageClient = await createLanguageClient(context);
            
            outputChannel = languageClient.outputChannel;
            outputChannel.appendLine('Starting MSBuild language service...');
            context.subscriptions.push(
                languageClient.start()
            );
            await languageClient.onReady();
            outputChannel.appendLine('MSBuild language service is running.');
        } else {
            outputChannel = vscode.window.createOutputChannel('MSBuild Project File Tools');
            
            if (enableLanguageService && !canEnableLanguageService)
                outputChannel.appendLine('Cannot enable the MSBuild language service because .NET Core 2.0.0 was not found on the system path.');
        
            outputChannel.appendLine('MSBuild language service disabled; using the classic completion provider.');
            
            const nugetEndPointURLs = await getNuGetV3AutoCompleteEndPoints();
            context.subscriptions.push(
                vscode.languages.registerCompletionItemProvider(
                    { language: 'xml', pattern: '**/*.*proj' }, 
                    new PackageReferenceCompletionProvider(
                        nugetEndPointURLs[0] // For now, just default to using the primary.
                    )
                )
            );
    
            outputChannel.appendLine('Classic completion provider is now enabled.');
        }
    });
}

/**
 * Called when the extension is deactivated.
 */
export function deactivate(): void {
    // Nothing to clean up.
}

/**
 * Load extension configuration from the workspace.
 */
function loadConfiguration(): void {
    const configuration = vscode.workspace.getConfiguration();

    enableLanguageService = configuration.get<boolean>('msbuildProjectFileTools.languageService.enable');
}

/**
 * Create the MSBuild language client.
 * 
 * @param context The current extension context.
 * @returns A promise that resolves to the language client.
 */
async function createLanguageClient(context: vscode.ExtensionContext): Promise<LanguageClient> {
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{
            language: 'xml',
            pattern: '*.csproj'
        }],
        synchronize: {
            // Synchronize the setting section 'languageServerExample' to the server
            configurationSection: 'msbuildProjectFileTools',
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        },
        errorHandler: {
            error: (error, message, count) =>
            {
                console.log(message);
                console.log(error);

                return ErrorAction.Continue;
            },
            closed: () => CloseAction.Restart
        }
    };

    const dotNetExecutable = await executables.find('dotnet');
    const serverAssembly = context.asAbsolutePath('out/language-server/LanguageServer.dll');
    const serverOptions: ServerOptions = {
        command: dotNetExecutable,
        args: [ serverAssembly ],
    };

    return new LanguageClient('MSBuild Project File Tools', serverOptions, clientOptions);
}
