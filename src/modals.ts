import { Setting, PluginSettingTab, App, Plugin, TFile, Modal, ButtonComponent } from 'obsidian'

declare class GardenSyncPlugin extends Plugin {
    publishNote: (e: any) => void
}

// modal to confirm publish
export class PublishModal extends Modal {
    app: App
    plugin: GardenSyncPlugin
    file: TFile

    constructor(app: App, plugin: GardenSyncPlugin, file: TFile) {
        super(app)
        this.plugin = plugin
        this.file = file
    }

    onOpen() {
        let { contentEl } = this
        contentEl.setText('Publish note: "' + this.file.name + '"?')
        let publishButton = new ButtonComponent(contentEl)
            .setButtonText('Publish')
            .onClick(() => {
                this.plugin.publishNote(this.file)
                this.close()
            })

        let cancelButton = new ButtonComponent(contentEl)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close()
            })
    }

    onClose() {
        let { contentEl } = this
        contentEl.empty()
    }
}

// check if user wants to override file
export class OverrideModal extends Modal {
    app: App
    plugin: GardenSyncPlugin
    next: () => void

    constructor(
        app: App,
        plugin: GardenSyncPlugin,
        next: () => void
    ) {
        super(app)
        this.plugin = plugin
        this.next = next
    }

    onOpen() {
        let { contentEl } = this
        contentEl.setText('File already exists. Override existing file?')
        let publishButton = new ButtonComponent(contentEl)
            .setButtonText('Override')
            .onClick(() => {
                this.next()
                this.close()
            })

        let cancelButton = new ButtonComponent(contentEl)
            .setButtonText('Cancel')
            .onClick(() => {
                this.close()
            })
    }

    onClose() {
        let { contentEl } = this
        contentEl.empty()
    }
}
