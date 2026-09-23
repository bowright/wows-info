import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUT_DIR = path.resolve(__dirname, '../public/images/consumables');

async function extractIcons() {
  console.log('-> Fetching consumable icons from upstream shiptool bundles...');
  
  const resData = await fetch('https://shiptool.st/assets/images-data-B9vtPd_X.js');
  if (!resData.ok) throw new Error(`HTTP ${resData.status} fetching images-data`);
  const textData = await resData.text();
  const jsonStrData = textData.slice(textData.indexOf('`') + 1, textData.lastIndexOf('`'));
  const arrData = JSON.parse(jsonStrData);

  const resUi = await fetch('https://shiptool.st/assets/images-ui-Cwys9bV0.js');
  if (!resUi.ok) throw new Error(`HTTP ${resUi.status} fetching images-ui`);
  const textUi = await resUi.text();
  const jsonStrUi = textUi.slice(textUi.indexOf('`') + 1, textUi.lastIndexOf('`'));
  const arrUi = JSON.parse(jsonStrUi);

  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  let count = 0;
  for (const item of arrData) {
    if (item.name.startsWith('consumable_')) {
      const b64 = item.url.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(path.join(OUT_DIR, item.name), Buffer.from(b64, 'base64'));
      count++;
    }
  }

  const sw = arrUi.find((x) => x.name === 'stopwatch.png');
  if (sw) {
    const b64 = sw.url.replace(/^data:image\/\w+;base64,/, '');
    fs.writeFileSync(path.join(OUT_DIR, 'stopwatch.png'), Buffer.from(b64, 'base64'));
    count++;
  }

  console.log(`[OK] Successfully saved ${count} consumable icons to ${OUT_DIR}`);
}

extractIcons().catch((err) => {
  console.error('Failed to extract consumable icons:', err);
  process.exit(1);
});
