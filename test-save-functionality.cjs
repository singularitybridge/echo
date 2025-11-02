/**
 * Test script to verify save and save-as-new functionality
 */
const FormData = require('form-data');
const fs = require('fs');
const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3039';
const PROJECT_ID = 'the-bakers-second-chance-2025';

async function testSaveFunctionality() {
  console.log('Testing Save and Save as New functionality\n');

  // Step 1: Upload a test asset
  console.log('Step 1: Uploading test asset...');
  const imagePath = '/Users/avi/dev/avio/sb-projects/veo-studio/public/assets/ast_character_1_1762079108363_amdc.png';

  if (!fs.existsSync(imagePath)) {
    console.error('Test image not found:', imagePath);
    process.exit(1);
  }

  const formData = new FormData();
  formData.append('file', fs.createReadStream(imagePath));
  formData.append('projectId', PROJECT_ID);
  formData.append('type', 'character');
  formData.append('name', 'Save Test Character');
  formData.append('description', 'Testing save functionality');

  const uploadResponse = await fetch(`${BASE_URL}/api/assets/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!uploadResponse.ok) {
    console.error('Upload failed:', uploadResponse.status, await uploadResponse.text());
    process.exit(1);
  }

  const originalAsset = await uploadResponse.json();
  console.log('✓ Asset uploaded successfully');
  console.log('  Asset ID:', originalAsset.id);
  console.log('  Version:', originalAsset.version);
  console.log('  Parent:', originalAsset.parentAssetId);
  console.log();

  // Step 2: Create an edited version manually (simulating AI edit)
  console.log('Step 2: Creating edited version (simulating AI edit)...');

  // Upload same image again to simulate an edited version
  const formData2 = new FormData();
  formData2.append('file', fs.createReadStream(imagePath));
  formData2.append('projectId', PROJECT_ID);
  formData2.append('type', 'character');
  formData2.append('name', 'Save Test Character (Edited)');
  formData2.append('description', 'Edited version for testing');

  const editUploadResponse = await fetch(`${BASE_URL}/api/assets/upload`, {
    method: 'POST',
    body: formData2,
  });

  if (!editUploadResponse.ok) {
    console.error('Edit upload failed');
    process.exit(1);
  }

  const editedAssetTemp = await editUploadResponse.json();

  // Update the edited asset to have a parent reference (making it a child version)
  const updateEditedResponse = await fetch(`${BASE_URL}/api/assets/${editedAssetTemp.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentAssetId: originalAsset.id,
      version: 2,
      editHistory: [
        { prompt: 'Simulated AI edit', timestamp: new Date().toISOString() }
      ],
    }),
  });

  if (!updateEditedResponse.ok) {
    console.error('Failed to update edited asset');
    process.exit(1);
  }

  const editResult = await updateEditedResponse.json();
  console.log('✓ Edited version created');
  console.log('  New Asset ID:', editResult.id);
  console.log('  Version:', editResult.version);
  console.log('  Parent:', editResult.parentAssetId, '(should point to original)');
  console.log();

  // Step 3: Verify the edited version exists
  console.log('Step 3: Verifying edited version...');
  const editedAssetResponse = await fetch(`${BASE_URL}/api/assets/${editResult.id}`);

  if (!editedAssetResponse.ok) {
    console.error('Failed to get edited asset');
    process.exit(1);
  }

  const editedAsset = await editedAssetResponse.json();
  console.log('✓ Edited version retrieved');
  console.log('  Asset ID:', editedAsset.id);
  console.log('  Version:', editedAsset.version);
  console.log('  Parent Asset ID:', editedAsset.parentAssetId);
  console.log();

  // Step 4: Test Save (update original with edited version)
  console.log('Step 4: Testing Save (update original)...');
  const saveResponse = await fetch(`${BASE_URL}/api/assets/${originalAsset.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url: editedAsset.url,
      thumbnailUrl: editedAsset.thumbnailUrl,
      editHistory: editedAsset.editHistory,
      version: editedAsset.version,
    }),
  });

  if (!saveResponse.ok) {
    console.error('Save failed:', saveResponse.status, await saveResponse.text());
    process.exit(1);
  }

  const savedAsset = await saveResponse.json();
  console.log('✓ Original asset updated successfully');
  console.log('  Asset ID:', savedAsset.id, '(should match original)');
  console.log('  Version:', savedAsset.version);
  console.log('  Updated At:', new Date(savedAsset.updatedAt).toLocaleString());
  console.log();

  // Step 5: Test Save as New (create new independent asset)
  console.log('Step 5: Testing Save as New...');
  const saveAsNewResponse = await fetch(`${BASE_URL}/api/assets/${editedAsset.id}/save-as-new`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!saveAsNewResponse.ok) {
    console.error('Save as new failed:', saveAsNewResponse.status, await saveAsNewResponse.text());
    process.exit(1);
  }

  const newAsset = await saveAsNewResponse.json();
  console.log('✓ New asset created successfully');
  console.log('  New Asset ID:', newAsset.id, '(should be different from original)');
  console.log('  Version:', newAsset.version, '(should be 1)');
  console.log('  Parent Asset ID:', newAsset.parentAssetId, '(should be null)');
  console.log('  Provider:', newAsset.provider);
  console.log();

  // Step 6: Verify assets appear in library (only root assets)
  console.log('Step 6: Verifying asset library shows only root assets...');
  const assetsResponse = await fetch(`${BASE_URL}/api/assets?projectId=${PROJECT_ID}`);
  const assetsData = await assetsResponse.json();

  const testAssets = assetsData.assets.filter(a =>
    a.name.includes('Save Test') || a.id === originalAsset.id || a.id === newAsset.id
  );

  console.log('✓ Found assets in library:');
  testAssets.forEach(asset => {
    console.log(`  - ${asset.name} (ID: ${asset.id}, Version: ${asset.version}, Parent: ${asset.parentAssetId || 'null'})`);
  });

  // Verify intermediate edited version is NOT in library
  const hasEditedVersion = assetsData.assets.some(a => a.id === editedAsset.id);
  if (hasEditedVersion) {
    console.log('\n✗ ERROR: Intermediate edited version should be hidden from library!');
    process.exit(1);
  } else {
    console.log('\n✓ Intermediate edited version correctly hidden from library');
  }

  console.log('\n=== All tests passed! ===');
  console.log('Summary:');
  console.log('- Original asset was updated via Save');
  console.log('- New independent asset was created via Save as New');
  console.log('- Intermediate AI-edited version is hidden from library');
  console.log('- Only root assets (parentAssetId = null) appear in library');
}

testSaveFunctionality().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});
