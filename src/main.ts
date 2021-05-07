import { fstat } from 'node:fs'
import { App, Modal, Notice, Plugin, TFile, FileSystemAdapter } from 'obsidian'
import * as path from 'path'
import { promises as fs } from 'fs'
import * as YAML from 'yaml'
import fm from 'front-matter'
import moment from 'moment'
import { performance } from 'perf_hooks'
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

        // ribbon icons, if ribbon icon setting is enabled
        if (this.settings.ribbonIcon) {
            this.addRibbonIcon(
                'sync',
                'Sync vault with digital garden',
                () => {
                    this.publishVault()
                }
            )

            this.addRibbonIcon(
                'paper-plane',
                'Publish note to digital garden',
                () => {
                    this.publishNote(this.app.workspace.getActiveFile(), true)
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

        // check if frontmatter exists
        if (frontmatter.frontmatter) {
            // parse frontmatter
            let parsedFrontmatter = YAML.parse(frontmatter.frontmatter)
            if(parsedFrontmatter.hasOwnProperty(this.settings.publicTag) && parsedFrontmatter[this.settings.publicTag] !== null) {
                // console.log('public frontmatter exists')
                if (isBoolean(parsedFrontmatter[this.settings.publicTag]) && parsedFrontmatter[this.settings.publicTag] !== null) {
                    // console.log('public frontmatter is boolean')
                    // get public attribute from frontmatter
                    let publicValue = YAML.parse(frontmatter.frontmatter)[this.settings.publicTag]
                    // return publicValue
                    return publicValue
                } else {
                    // console.log('public frontmatter is not boolean')
                    return this.settings.defaultPublic
                }
            } else {
                // console.log('public frontmatter does not exist or is null')
                return this.settings.defaultPublic
            }
        } else {
            // console.log('no frontmatter')
            return this.settings.defaultPublic
        }
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

    // TODO: add give notice setting and implement it everywhere that this function is called
    // publish the current note
    async publishNote(file: TFile, giveNotice: boolean) {
        let adapter = this.app.vault.adapter as FileSystemAdapter

        // TODO: I have to see how this works on non-Windows systems, paths might be tricky
        // set paths
        let oldPath = adapter.getFullPath(file.path)
        let normalizedOldPath = oldPath.replace(/\\/g, '/')
        let newPath = path.join(this.settings.gardenPath, file.path)
        let normalizedNewPath = newPath.replace(/\\/g, '/')

        let noteOldPublic = await this.checkNotePublic(file)
        this.setNotePublic(file, true)

        const checkFileCreated = async (_path: string) => {
            // check if file exists, after creation
            try {
                await fs.access(_path)
                console.log('Published note: ' + file.name)
                giveNotice && new Notice('Published note: ' + file.name)

                this.updateFrontmatter(file, true)
            } catch (err) {
                // no access to file (does not exist?)
                console.log('Error copying file: ' + file.name)
                giveNotice && new Notice('Error copying file')
                adapter.write('garden-sync-error.md', err)

                this.setNotePublic(file, noteOldPublic)
            }
        }

        // copy file to content directory
        const copyFile = async (_old: string, _new: string) => {
            // console.log('Publishing note: ' + file.name)
            // check if file gets copied
            try {
                // file gets copied
                await fs.copyFile(_old, _new)
                // check if file is actually created
                checkFileCreated(_new)
            } catch (err) {
                // could not copy file
                console.log('Error copying file: ' + file.name)
                giveNotice && new Notice('Error copying file: ' + file.name)
                console.log("See 'garden-sync-error.md'")
                giveNotice && new Notice("See 'garden-sync-error.md'")
                adapter.write('garden-sync-error.md', err)

                this.setNotePublic(file, noteOldPublic)
            }
        }

        // check if file exists
        try {
            // file gets accessed
            await fs.access(normalizedNewPath)
            // check if alwaysOverride is enabled
            if (this.settings.alwaysOverride) {
                // alwaysOverride is true, don't ask user before copying
                copyFile(normalizedOldPath, normalizedNewPath)
            } else {
                // alwaysOverride is false, ask user before copying
                new OverrideModal(this.app, file, async () => {
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

                this.setNotePublic(file, noteOldPublic)
            }
        }
    }

    // TODO: ask before publishing entire vault, if settings.alwaysAsk is true

    // publish entire vault
    async publishVault() {
        let t0 = performance.now()
        // get all files
        let allMarkdownFiles = this.app.vault.getMarkdownFiles()
        // count files
        let allFilesCount = allMarkdownFiles.length
        let attemptedFilesCount = 0
        let publishedFilesCount = 0
        let t1 = performance.now()
        // publish each file
        allMarkdownFiles.forEach(async (markdownFile) => {
            // check if file is public
            let notePublic = await this.checkNotePublic(markdownFile)
            if (notePublic) {
                // note is public, so publish it
                await this.publishNote(markdownFile, false)
                publishedFilesCount++
                attemptedFilesCount++
            } else {
                // note is private
                console.log(`${markdownFile.name} is private`)
                attemptedFilesCount++
            }
            if (attemptedFilesCount === allFilesCount) {
                let t2 = performance.now()
                console.log(`Published ${publishedFilesCount}/${allFilesCount} notes in ${t1-t0} + ${t2-t1} = ${t2-t0} ms`)
                new Notice(`Published ${publishedFilesCount}/${allFilesCount} notes`)
            }
        })
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
