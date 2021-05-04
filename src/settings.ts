import { Setting, PluginSettingTab, App, Plugin, Notice } from 'obsidian'

import { PublishModal } from './modals'

declare class GardenSyncPlugin extends Plugin {
    settings: GardenSyncSettings
    publishNote: (e: any) => void
    refresh: (e: any) => void
}

export interface GardenSyncSettings {
    gardenPath: string
    alwaysAsk: boolean
    alwaysOverride: boolean
    ribbonIcon: boolean
}

export const DEFAULT_SETTINGS: GardenSyncSettings = {
    gardenPath: '',
    alwaysAsk: true,
    alwaysOverride: false,
    ribbonIcon: true
}

// garden sync setting tab
export class GardenSyncSettingTab extends PluginSettingTab {
    plugin: GardenSyncPlugin

    constructor(app: App, plugin: GardenSyncPlugin) {
        super(app, plugin)
        this.plugin = plugin
    }

    display(): void {
        let { containerEl } = this

        containerEl.empty()

        // settings.gardenPath
        new Setting(containerEl)
            .setName('Garden content directory')
            .setDesc('Set the path that published notes will be synced to')
            .addText(text =>
                text
                    .setPlaceholder('D:/Garden')
                    .setValue(this.plugin.settings.gardenPath)
                    .onChange(async value => {
                        this.plugin.settings.gardenPath = value
                        await this.plugin.saveData(this.plugin.settings)
                    })
            )

        // settings.alwaysAsk
        new Setting(containerEl)
            .setName('Always ask before publishing note')
            .setDesc(
                'Every publish request will open a pop-up to confirm publishing.'
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.alwaysAsk)
                    .onChange(async toggle => {
                        this.plugin.settings.alwaysAsk = toggle
                        await this.plugin.saveData(this.plugin.settings)
                    })
            )

        // settings.alwaysOverride
        new Setting(containerEl)
            .setName('Always override existing file (DESTRUCTIVE)')
            .setDesc(
                'Never ask before overriding files in garden content directory. DESTRUCTIVE to digital garden files, not files in vault (unless vault is set as garden content directory).'
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.alwaysOverride)
                    .onChange(async toggle => {
                        this.plugin.settings.alwaysOverride = toggle
                        await this.plugin.saveData(this.plugin.settings)
                    })
            )

        // settings.ribbonIcon
        new Setting(containerEl)
            .setName('Toggle ribbon icon (publish current note)')
            .setDesc(
                'Toggles icon on the ribbon to publish current note (reload Obsidian to take effect)'
            )
            .addToggle(toggle =>
                toggle
                    .setValue(this.plugin.settings.ribbonIcon)
                    .onChange(async toggle => {
                        this.plugin.settings.ribbonIcon = toggle
                        await this.plugin.saveData(this.plugin.settings)
                    })
            )

        // TODO: Toggle automatic publishes
        // TODO: Automatic publishes interval

        // TODO: Toggle notices for automatic publishes
    }
}

export class GardenSyncCommands {
    plugin: GardenSyncPlugin
    constructor(plugin: GardenSyncPlugin) {
        this.plugin = plugin
    }

    addCommands(): void {
        // Publish current note command
        this.plugin.addCommand({
            id: 'publish-current-note',
            name: 'Publish current note',
            checkCallback: (checking: boolean) => {
                let leaf = this.plugin.app.workspace.activeLeaf
                if (leaf) {
                    if (!checking) {
                        // this.publishNote(this.app.workspace.getActiveFile());
                        if (this.plugin.settings.alwaysAsk) {
                            new PublishModal(
                                this.plugin.app,
                                this.plugin,
                                this.plugin.app.workspace.getActiveFile()
                            ).open()
                        } else {
                            this.plugin.publishNote(
                                this.plugin.app.workspace.getActiveFile()
                            )
                        }
                    }
                    return true
                }
                return false
            },
        })

        // FIXME:
        // Refresh plugin command
        this.plugin.addCommand({
            id: 'refresh-plugin',
            name: 'Refresh plugin',
            callback: () => {
                this.plugin.refresh;
            }
        })

        // region: Toggle setting commands
        // Toggle always ask command
        this.plugin.addCommand({
            id: 'toggle-always-ask',
            name: 'Toggle always ask before publishing note',
            callback: () => {
                this.plugin.settings.alwaysAsk = !this.plugin.settings.alwaysAsk
                new Notice(
                    "'Always ask' set to: " + this.plugin.settings.alwaysAsk
                )
                this.plugin.saveData(this.plugin.settings)
            },
        })

        // Toggle always override command
        this.plugin.addCommand({
            id: 'toggle-always-override',
            name: 'Toggle always override existing file (DESTRUCTIVE)',
            callback: () => {
                this.plugin.settings.alwaysOverride = !this.plugin.settings
                    .alwaysOverride
                new Notice(
                    "'Always override' set to: " +
                        this.plugin.settings.alwaysOverride
                )
                this.plugin.saveData(this.plugin.settings)
            },
        })

        // Toggle ribbon icon command
        this.plugin.addCommand({
            id: 'toggle-ribbon-icon',
            name: 'Toggle ribbon icon (publish current note)',
            callback: () => {
                this.plugin.settings.ribbonIcon = !this.plugin.settings
                    .ribbonIcon
                new Notice(
                    "'Always override' set to: " +
                        this.plugin.settings.ribbonIcon
                )
                this.plugin.saveData(this.plugin.settings)
            },
        })
    }
}
