import { fstat } from 'node:fs'
import { App, Modal, Notice, Plugin, TFile, FileSystemAdapter } from 'obsidian'
import * as path from 'path'
import { promises as fs } from 'fs'
import * as YAML from 'yaml'
import fm from 'front-matter'
import moment from 'moment'
// const moment = require('moment')

import {
    GardenSyncSettings,
    DEFAULT_SETTINGS,
    GardenSyncSettingTab,
    GardenSyncCommands,
} from './settings'
import { PublishModal, OverrideModal } from './modals'

export default class GardenSyncPlugin extends Plugin {
    settings: GardenSyncSettings

    async onload() {
        console.log('Loading Digital Garden Sync')
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
                    // TODO: set this to publish function again
                    this.updateFrontmatter(
                        this.app.workspace.getActiveFile(),
                        true
                    )
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
    refresh() {
        this.unload()
        this.load()
    }

    // read frontmatter from file (returns object with optional .frontmatter child)
    async readFrontmatter(file: TFile) {
        // read file
        let fileContent = await this.app.vault.read(file)
        // return fm object
        return fm(fileContent)
    }

    // write frontmatter to file
    async writeFrontmatter(file: TFile, newFrontmatter: any, fileBody: string) {
        let newFileContent = `---\n${YAML.stringify(newFrontmatter)}\n---\n\n${fileBody}`
        this.app.vault.modify(file, newFileContent)
    }

    // read frontmatter, update attributes, and write to file
    async updateFrontmatter(file: TFile, _public: boolean) {
        let newFrontmatter

        // read file and assign old frontmatter and body
        let oldFileContent = await this.readFrontmatter(file)
        let oldBody = oldFileContent.body

        // check if file already has frontmatter
        if (oldFileContent.frontmatter) {
            // frontmatter exists, so parse it
            let oldFrontmatter = YAML.parse(oldFileContent.frontmatter)

            // set new frontmatter to old frontmatter
            newFrontmatter = {...oldFrontmatter}

            // update/add new attributes
            newFrontmatter['date published'] = moment().format(this.settings.dateFormat)
            newFrontmatter[this.settings.publicTag] = _public
        } else {
            // frontmatter doesn't exist, so create it
            newFrontmatter = {
                'date published': moment().format(this.settings.dateFormat),
                [this.settings.publicTag]: _public,
            }
        }

        await this.writeFrontmatter(file, newFrontmatter, oldBody)
    }

    // check if a note has frontmatter: "public: true" (or similar)
    async checkNotePublic(file: TFile) {
        // get frontmatter from file
        let frontmatter = await this.readFrontmatter(file)
        // get public attribute from frontmatter
        let publicValueString = YAML.parse(frontmatter.frontmatter)[
            this.settings.publicTag
        ]
        // check if value of public attribute is true
        let publicValue =
            publicValueString === true ||
            publicValueString === 'true' ||
            publicValueString === 'yes'
        return publicValue
    }

    async setNotePublic(file: TFile, _public: boolean) {
        let newFrontmatter

        // read file and assign old frontmatter and body
        let oldFileContent = await this.readFrontmatter(file)
        let oldBody = oldFileContent.body

        // check if file already has frontmatter
        if (oldFileContent.frontmatter) {
            // frontmatter exists, so parse it
            let oldFrontmatter = YAML.parse(oldFileContent.frontmatter)

            // set new frontmatter to old frontmatter
            newFrontmatter = { ...oldFrontmatter }

            // update/add new attributes
            newFrontmatter[this.settings.publicTag] = _public
        } else {
            // frontmatter doesn't exist, so create it
            newFrontmatter = {
                [this.settings.publicTag]: _public,
            }
        }

        await this.writeFrontmatter(file, newFrontmatter, oldBody)
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

        this.setNotePublic(file, true)

        const checkFileCreated = async (_path: string) => {
            // check if file exists, after creation
            try {
                await fs.access(_path)
                new Notice('Published note: ' + file.name)
            } catch (err) {
                // no access to file (does not exist?)
                new Notice('Error copying file')
                adapter.write('garden-sync-error.md', err)

                this.setNotePublic(file, false)
            }
        }

        const copyFile = async (_old: string, _new: string) => {
            new Notice('Publishing note...')
            try {
                await fs.copyFile(_old, _new)
                checkFileCreated(_new)
            } catch (err) {
                new Notice('Error copying file!')
                new Notice("See 'garden-sync-error.md'")
                adapter.write('garden-sync-error.md', err)

                this.setNotePublic(file, false)
            }
        }

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
                new Notice(
                    'Garden content directory does not exist. Please check path in settings.'
                )

                this.setNotePublic(file, true)
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
