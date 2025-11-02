/**
 * Cleanup script to remove duplicate assets from the-bakers-second-chance-2025 project
 */
const fs = require('fs');
const path = require('path');

const assetsFile = path.join(__dirname, 'data', 'assets-metadata.json');

// Read the assets metadata
const metadata = JSON.parse(fs.readFileSync(assetsFile, 'utf-8'));

// Asset IDs to keep (first set of 4)
const keepIds = [
  'ast_character_1_1762079108363_amdc',
  'ast_character_2_1762079108572_s1a6',
  'ast_character_3_1762079108731_976o',
  'ast_character_4_1762079108788_b154',
];

// Asset IDs to delete (duplicates)
const deleteIds = [
  'ast_character_1_1762079112029_1mfe',
  'ast_character_2_1762079112213_xi24',
  'ast_character_3_1762079112272_d0jv',
  'ast_character_4_1762079112481_u4yx',
  'ast_character_1_1762079149684_5fkt',
  'ast_character_2_1762079150549_5jm1',
  'ast_character_3_1762079151046_0qrg',
  'ast_character_4_1762079151085_770a',
];

console.log('Before cleanup:');
console.log(`Total assets: ${Object.keys(metadata.assets).length}`);
console.log(`Assets for the-bakers-second-chance-2025: ${metadata.index.byProject['the-bakers-second-chance-2025'].length}`);

// Delete duplicate assets from assets object
deleteIds.forEach(id => {
  if (metadata.assets[id]) {
    delete metadata.assets[id];
    console.log(`Deleted asset: ${id}`);
  }
});

// Update the index for the-bakers-second-chance-2025 project
metadata.index.byProject['the-bakers-second-chance-2025'] = keepIds;

// Update byType index - remove deleted IDs
metadata.index.byType.character = metadata.index.byType.character.filter(
  id => !deleteIds.includes(id)
);

// Update byTag index - remove deleted IDs from story-storage tag
if (metadata.index.byTag['story-storage']) {
  metadata.index.byTag['story-storage'] = metadata.index.byTag['story-storage'].filter(
    id => !deleteIds.includes(id)
  );
}

if (metadata.index.byTag['character']) {
  metadata.index.byTag['character'] = metadata.index.byTag['character'].filter(
    id => !deleteIds.includes(id)
  );
}

console.log('\nAfter cleanup:');
console.log(`Total assets: ${Object.keys(metadata.assets).length}`);
console.log(`Assets for the-bakers-second-chance-2025: ${metadata.index.byProject['the-bakers-second-chance-2025'].length}`);

// Save the cleaned metadata
fs.writeFileSync(assetsFile, JSON.stringify(metadata, null, 2));
console.log('\nDatabase cleaned successfully!');
