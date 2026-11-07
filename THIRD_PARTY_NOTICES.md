# Third-party notices

The same information is shown in the app at `/licenses/` (source: `public/licenses/`).

## js-ballistics

- Source: https://github.com/o-murphy/js-ballistics
- License: ISC — Copyright 2023 o-murphy
- Full text: [public/licenses/js-ballistics-ISC.txt](public/licenses/js-ballistics-ISC.txt)

## bclibc (bundled inside js-ballistics as WebAssembly)

- Source: https://github.com/ballistics-lab/bclibc
- License: GNU Lesser General Public License v3 (LGPL-3.0)
- Full texts: [LGPL-3.0](public/licenses/LGPL-3.0.txt), [GPL-3.0](public/licenses/GPL-3.0.txt)
- Used unmodified, exactly as shipped in the `js-ballistics` npm package.
- This app's complete source and build scripts are public in this repository, so anyone can
  rebuild it against a modified bclibc (LGPL-3.0 section 4).

## Inter font (bundled for offline use)

- Source: https://github.com/rsms/inter, via the `@fontsource-variable/inter` npm package
- License: SIL Open Font License 1.1 — Copyright 2016 The Inter Project Authors
- Full text: [public/licenses/Inter-OFL-1.1.txt](public/licenses/Inter-OFL-1.1.txt)
- Bundled unmodified (Latin variable font). The OFL allows bundling with software
  as long as the license and copyright notice travel with it and the font isn't sold on its own.

## Factory ammo library (`src/library/ammo.ts`)

- Contains only facts (velocity, test barrel length, BC, weight, bullet length) copied by hand
  from each manufacturer's own product page, with the source URL and date on every entry.
- No scraping, no copying of other apps' or websites' databases, no product descriptions,
  photos or logos, and no Applied Ballistics custom drag models.
- Brand and product names are trademarks of their owners, used only to identify products
  ("no endorsement implied" is shown in the app and on the licenses page).
- Barrel-length velocity figures cite the published cut-down tests they come from
  (`src/library/barrelEstimate.ts`).

## How to stay compliant

1. Keep the files in `public/licenses/` and the in-app "Licenses & disclaimer" link.
2. Do not modify js-ballistics or bclibc. If we ever must, publish the changes.
3. Keep this repository public (or otherwise provide the source) while the app is distributed.
4. When upgrading js-ballistics, re-check its license and the bclibc license and update this file.
