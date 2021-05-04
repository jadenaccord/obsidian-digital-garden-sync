import { fstat } from 'node:fs';
import { App, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, ButtonComponent, FileSystemAdapter } from 'obsidian';
import * as path from 'path';
import { promises as fs } from 'fs';

interface GardenSyncSettings {
	mySetting: string;
	gardenPath: string;
}

const DEFAULT_SETTINGS: GardenSyncSettings = {
	mySetting: 'default',
	gardenPath: ''
}

export default class GardenSync extends Plugin {
	settings: GardenSyncSettings;

	async onload() {
		console.log('loading plugin');

		await this.loadSettings();

		this.addRibbonIcon('dice', 'Sample Plugin', () => {
			this.publishNote(this.app.workspace.getActiveFile());
		});

		this.addStatusBarItem().setText('Status Bar Text');

		this.addCommand({
			id: 'open-sample-modal',
			name: 'Open Sample Modal',
			// callback: () => {
			// 	console.log('Simple Callback');
			// },
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						new SampleModal(this.app, 'blub').open();
					}
					return true;
				}
				return false;
			}
		});

		this.addCommand({
			id: 'publish-current-note',
			name: 'Publish current note',
			checkCallback: (checking: boolean) => {
				let leaf = this.app.workspace.activeLeaf;
				if (leaf) {
					if (!checking) {
						// this.publishNote(this.app.workspace.getActiveFile());
						new PublishModal(this.app, this, this.app.workspace.getActiveFile()).open();
					}
					return true;
				}
				return false;
			}
		})

		this.addSettingTab(new GardenSyncSettingTab(this.app, this));

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			console.log('codemirror', cm);
		});

		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {
		console.log('unloading plugin');
	}

	// settings loading and saving
	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// publish the current note
	async publishNote(file: TFile) {
		let adapter = this.app.vault.adapter as FileSystemAdapter;

		// TODO: I have to see how this works on non-Windows systems, paths might be tricky
		// set paths
		let oldPath = adapter.getFullPath(file.path);
		let normalizedOldPath = oldPath.replace(/\\/g, "/");
		new Notice('Old normal: ' + normalizedOldPath); // debug
		let newPath = path.join(this.settings.gardenPath, file.path);
		let normalizedNewPath = newPath.replace(/\\/g, "/");
		new Notice('New normal: ' + normalizedNewPath); // debug

		// TODO: check if file exists already, if so: ask user if they want to override existing file using modal
		try {
			await fs.access(normalizedNewPath);
			new Notice('File exists already. Override?') // debug
			// TODO: ask user if they want to override existing file
		} catch (err) {
            // no access to file (does not exist?)

            // copy file to garden directory (using fs)
            try {
                await fs.copyFile(normalizedOldPath, normalizedNewPath)

                // check if file exists, after creation
                try {
                    await fs.access(normalizedNewPath)
					new Notice('Published note: ' + file.name)
                } catch (err) {
                    // no access to file (does not exist?)
                    new Notice('Error copying file')
                    adapter.write('garden-sync-error.md', err)
                }
            } catch (err) {
                // fs.copyFile returned an error
                new Notice('Error copying file')
                adapter.write('garden-sync-error.md', err)
            }
        }
	}
}

class SampleModal extends Modal {
	app: App;
	text: string;

	constructor(app: App, text: string) {
		super(app);
		this.text = text;
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText(this.text);
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty();
	}
}

// modal to confirm publish
class PublishModal extends Modal {
	app: App;
	plugin: GardenSync;
	file: TFile;

	constructor(app: App, plugin: GardenSync, file: TFile) {
		super(app);
		this.plugin = plugin;
		this.file = file;
	}

	onOpen() {
		let {contentEl} = this;
		// contentEl.setText('Publish note?')
		let inputButton = new ButtonComponent(contentEl)
			.setButtonText("Publish note")
			.onClick(() => {
				this.plugin.publishNote(this.file);
				this.close();
			});
	}

	onClose() {
		let {contentEl} = this;
		contentEl.empty
	}
}

// garden sync setting tab
class GardenSyncSettingTab extends PluginSettingTab {
	plugin: GardenSync;

	constructor(app: App, plugin: GardenSync) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		// sample setting (settings.mySetting)
		new Setting(containerEl)
			.setName('Setting #1')
			.setDesc('It\'s a secret')
			.addText(text => text
				.setPlaceholder('Enter your secret')
				.setValue('')
				.onChange(async (value) => {
					console.log('Secret: ' + value);
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		// settings.gardenPath
		new Setting(containerEl)
			.setName('Garden content directory')
			.setDesc('Set the path that published notes will be synced to')
			.addText(text => text
				.setPlaceholder('D:/Garden')
				.setValue(this.plugin.settings.gardenPath)
				.onChange(async (value) => {
					this.plugin.settings.gardenPath = value;
					await this.plugin.saveSettings();
				}));
	}
}
