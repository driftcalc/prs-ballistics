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

## How to stay compliant

1. Keep the files in `public/licenses/` and the in-app "Licenses & disclaimer" link.
2. Do not modify js-ballistics or bclibc. If we ever must, publish the changes.
3. Keep this repository public (or otherwise provide the source) while the app is distributed.
4. When upgrading js-ballistics, re-check its license and the bclibc license and update this file.
