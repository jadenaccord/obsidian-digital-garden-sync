# Digital Garden Sync for Obsidian

Sync your Obsidian notes with your (external) Digital Garden, while keeping your private notes private.

## Usage

### Simple Publish
Publishes your active note, regardless of whether it has `public: true` in its YAML frontmatter.

1. Enter the path to your digital garden's content directory in the plugin's settings
2. Use the command, ribbon icon or hotkey to 'publish' your active note (i.e. copy the file to the content directory)

### Vault Sync
Scans your entire vault for files with `public: true` in their YAML frontmatter and publishes them.

### Auto Publish
Same as Vault Publish, but automatically repeats on an interval set by the user.

### Settings
- Garden content directory
    - Set the path that published notes will be synced to
- Always ask before publishing note
    - Every publish request will open a pop-up to confirm publishing.
- Always override existing file (DESTRUCTIVE)
    - Never ask before overriding files in garden content directory. DESTRUCTIVE to digital garden files, not files in vault (unless vault is set as garden content directory).
- Toggle ribbon icon (publish current note)
    - Toggles icon on the ribbon to publish current note (reload Obsidian to take effect)
- YAML public attribute
    - Set the YAML attribute used to check if a file is public. (The value will have to be set to 'true' or 'yes')
- Date format
    - Set the format for output date. See https://momentjs.com/docs/#/displaying/format/

## Examples

## Roadmap

- [x] Publish active file
- [x] Read and update YAML frontmatter
- [x] Sync entire vault
- [ ] Automatically sync entire vault with digital garden (user set interval)
- [ ] Two-way sync
- [ ] Automatically git push

## Version History

### v0.1.0
- Publish active file
- Read and update YAML frontmatter
- Sync entire vault

## Contributing
Contributions in the form of bug reports, bug fixes, documentation and other tweaks are always welcome. You can work on more major changes, but please reach out first.

## Support
<form action="https://www.paypal.com/donate" method="post" target="_top">
<input type="hidden" name="hosted_button_id" value="FNCKUEA58K3PA" />
<input type="image" src="https://www.paypalobjects.com/en_US/NL/i/btn/btn_donateCC_LG.gif" border="0" name="submit" title="PayPal - The safer, easier way to pay online!" alt="Donate with PayPal button" />
<img alt="" border="0" src="https://www.paypal.com/en_NL/i/scr/pixel.gif" width="1" height="1" />
</form>