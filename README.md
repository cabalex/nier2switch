# NieR2Switch
A one click NieR to Switch converter that runs in your browser, built off previous Platinum Games tools I've created. It's never been easier to make a NieR Switch mod!


## Caveats
- There may be subtle differences due to Switch rendering optimizations. Your game *will* run slower since PC assets are not optimized for Switch.
- While the converter does its best to preserve original file data, there may be times where it can create invalid file data. Please report these!
- Certain files (e.g. font/) require an ASTC texture (at least, from what I can tell). I'm unsure if there's a way around this, but the game will refuse to load these files.

## Process
- Extract ZIP
- Extract DAT/DTTs with WTA/WTP files
- For WTA/WTP pairs:
  - Read WTA header and extract WTP texture data
  - Swizzle texture data
  - Replace texture info headers with NieR Switch texture info
  - Repack WTP texture data
- Repack DAT/DTTs
- Repack ZIP