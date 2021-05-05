import { fstat } from 'node:fs'
import {
    App,
    Modal,
    Notice,
    Plugin,
    PluginSettingTab,
    Setting,
    TFile,
    ButtonComponent,
    FileSystemAdapter,
    TextComponent,
    ValueComponent,
    parseYaml,
} from 'obsidian'
import * as path from 'path'
import { promises as fs } from 'fs'
import fm from 'front-matter'
import * as moment from 'moment'

import { GardenSyncSettings, DEFAULT_SETTINGS, GardenSyncSettingTab, GardenSyncCommands } from './settings'
import { PublishModal, OverrideModal } from './modals'

export default class GardenSyncPlugin extends Plugin {
    settings: GardenSyncSettings

    async onload() {
        // load settings
        this.settings = Object.assign(
            {},
            DEFAULT_SETTINGS,
            await this.loadData()
        )

        // publish note ribbon icon, if ribbon icon setting is enabled
        if (this.settings.ribbonIcon) {
            this.addRibbonIcon(
                'dice',
                'Garden Sync: Publish current note',
                () => {
                    // if (this.settings.alwaysAsk) {
                    //     new PublishModal(
                    //         this.app,
                    //         this,
                    //         this.app.workspace.getActiveFile()
                    //     ).open()
                    // } else {
                    //     this.publishNote(this.app.workspace.getActiveFile())
                    // }
                    this.readFrontmatter(this.app.workspace.getActiveFile())
                }
            )
        }

        // sample status bar item
        this.addStatusBarItem().setText('Garden Sync Active')

        // Add setting tab
        this.addSettingTab(new GardenSyncSettingTab(this.app, this))

        // Add commands
        new GardenSyncCommands(this).addCommands()

        // sample registers functions
        this.registerCodeMirror((cm: CodeMirror.Editor) => {
            console.log('codemirror', cm)
        })

        this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
            console.log('click', evt)
        })

        this.registerInterval(
            window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000)
        )
    }

    onunload() {
        console.log('unloading plugin')
    }

    // FIXME:
    refresh () {
        this.unload()
        this.load()
    }

    async readFrontmatter(file: TFile) {
        // read file
        let content = await this.app.vault.read(file)
        // parse YAML to object and return
        let yaml = parseYaml(fm(content).frontmatter)
        console.log(JSON.stringify(yaml))
        return yaml
    }

    async checkNotePublic(file: TFile) {
        // get frontmatter from file
        let frontmatter = await this.readFrontmatter(file)
        // get public attribute from frontmatter
        let publicValueString = frontmatter[this.settings.publicTag]
        // check if value of public attribute is true
        let publicValue = (publicValueString === true || publicValueString === 'true' || publicValueString === 'yes')
        return publicValue
    }

    async updateFrontmatter(file: TFile) {
        // TODO: update YAML frontmatter for new publish data
        let publishedDate = moment().format(this.settings.dateFormat)
    }

    // publish the current note
    async publishNote(file: TFile) {
        let adapter = this.app.vault.adapter as FileSystemAdapter

        // TODO: I have to see how this works on non-Windows systems, paths might be tricky
        // set paths
        let oldPath = adapter.getFullPath(file.path)
        let normalizedOldPath = oldPath.replace(/\\/g, '/')
        let newPath = path.join(this.settings.gardenPath, file.path)
        let normalizedNewPath = newPath.replace(/\\/g, '/')

        const checkFileCreated = async (_path: string) => {
            // check if file exists, after creation
            try {
                await fs.access(_path)
                new Notice('Published note: ' + file.name)
            } catch (err) {
                // no access to file (does not exist?)
                new Notice('Error copying file')
                adapter.write('garden-sync-error.md', err)
            }
        }

        const copyFile = async (_old: string, _new: string) => {
            new Notice('Publishing note...')
            try {
                await fs.copyFile(_old, _new)
                checkFileCreated(_new)
            } catch(err) {
                new Notice('Error copying file!')
                new Notice("See 'garden-sync-error.md'")
                adapter.write('garden-sync-error.md', err)
            }
        }

        /*
        NOTES

        fs.access file?
            - Yes: file exists
                - alwaysOverride?
                    - Yes: override
                        copyFile()
                    - No: check with user first
                        new OverrideModal()
                            - Confirm:
                                copyFile()
                            - Cancel:
                                nothing
            - No: file doesn't exist
                - fs.access dir?
                    - Yes: file doesn't exist, directory does
                        - copyFile()
                    - No: file and directory don't exist
                        - Either:
                            - Create directory
                            - copyFile()
                        Or:
                            - Tell user garden content directory does not exist
                            - Ask user to check if the path in settings is correct
        */

        // check if file exists
        try {
            await fs.access(normalizedNewPath)
            // check if alwaysOverride is enabled
            if (this.settings.alwaysOverride) {
                // alwaysOverride is true, don't ask user before copying
                copyFile(normalizedOldPath, normalizedNewPath)
            } else {
                // alwaysOverride is false, ask user before copying
                new OverrideModal(this.app, this, async () => {
                    copyFile(normalizedOldPath, normalizedNewPath)
                }).open()
            }
        } catch {
            // file does not exist
            // check if directory exists
            try {
                // directory exists (with nothing to override)
                copyFile(normalizedOldPath, normalizedNewPath)
            } catch {
                // directory doesn't exist
                // tell user to check if the path in settings is correct
                new Notice('Garden content directory does not exist. Please check path in settings.')
            }
        }
    }
}

class SampleModal extends Modal {
    text: string

    constructor(app: App, text: string) {
        super(app)
        this.text = text
    }

    onOpen() {
        let { contentEl } = this
        contentEl.setText(this.text)
    }

    onClose() {
        let { contentEl } = this
        contentEl.empty()
    }
}