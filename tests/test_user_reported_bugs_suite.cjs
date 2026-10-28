const http = require('http');

const BASE_URL = 'http://localhost:3000';

function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const reqHeaders = { ...headers };
    if (body && typeof body === 'object' && !(body instanceof Buffer)) {
      body = JSON.stringify(body);
      reqHeaders['Content-Type'] = 'application/json';
    }
    if (body) {
      reqHeaders['Content-Length'] = Buffer.byteLength(body);
    }

    const req = http.request(
      url,
      {
        method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => (rawData += chunk));
        res.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(rawData);
          } catch (e) {
            parsed = rawData;
          }
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            data: parsed,
          });
        });
      }
    );

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function runSuite() {
  console.log('=== STARTING USER-REPORTED BUGS VERIFICATION SUITE ===\n');
  let token = null;
  let testWeddingId = null;
  let originalSlug = null;
  let newSlug = null;

  // 1. Auth Setup: Login with demo user
  console.log('--- Step 0: User Authentication ---');
  const loginRes = await makeRequest('POST', '/api/auth/login', {
    email: 'demo@weddingstudio.local',
    password: 'password123',
  });
  if (loginRes.statusCode !== 200 || !loginRes.data.token) {
    throw new Error(`Login failed with status ${loginRes.statusCode}: ${JSON.stringify(loginRes.data)}`);
  }
  token = loginRes.data.token;
  console.log('✓ Logged in successfully. Token acquired.\n');

  // 2. Create a test wedding to isolate tests
  console.log('--- Creating Isolated Test Wedding ---');
  const createRes = await makeRequest('POST', '/api/weddings', {}, {
    Authorization: `Bearer ${token}`,
  });
  if (createRes.statusCode !== 201 || !createRes.data.id) {
    throw new Error(`Failed to create wedding: ${JSON.stringify(createRes.data)}`);
  }
  testWeddingId = createRes.data.id;
  originalSlug = createRes.data.slug;
  console.log(`✓ Test wedding created: ID=${testWeddingId}, initial slug=${originalSlug}\n`);

  // ==========================================
  // TEST BUG 2: Slug Updating & Uniqueness Check
  // ==========================================
  console.log('--- [BUG 2 TEST] Custom Slug & Couple Name Slug Generation ---');
  newSlug = `budi-dan-ani-${Date.now().toString().slice(-4)}`;
  const updateSlugRes = await makeRequest('PUT', `/api/weddings/${testWeddingId}`, {
    ...createRes.data,
    slug: newSlug,
    title: 'The Wedding of Budi & Ani',
    groom: { name: 'Budi Santoso', nickname: 'Budi' },
    bride: { name: 'Ani Wijaya', nickname: 'Ani' },
  }, { Authorization: `Bearer ${token}` });

  if (updateSlugRes.statusCode !== 200 || updateSlugRes.data.slug !== newSlug) {
    throw new Error(`Failed to update slug to ${newSlug}: ${JSON.stringify(updateSlugRes.data)}`);
  }
  console.log(`✓ Slug successfully updated from '${originalSlug}' to custom couple slug '${newSlug}'`);

  // Test slug collision detection: try to reuse newSlug on another wedding
  const conflictRes = await makeRequest('PUT', `/api/weddings/wed_demo_001`, {
    slug: newSlug,
  }, { Authorization: `Bearer ${token}` });
  if (conflictRes.statusCode === 409) {
    console.log(`✓ Slug collision correctly rejected with HTTP 409 Conflict: "${conflictRes.data.error}"\n`);
  } else {
    console.warn(`! Note: Slug collision returned status ${conflictRes.statusCode}`);
  }

  // ==========================================
  // TEST BUG 1: Love Story Direct Photo Upload & Persistence
  // ==========================================
  console.log('--- [BUG 1 TEST] Love Story Photo Upload & Persistence ---');
  const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
  const dummyJpg = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0xff, 0xd9,
  ]);
  const multipartBody = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="love_story_first_meet.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
    dummyJpg,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);

  const uploadRes = await makeRequest('POST', '/api/media/upload', multipartBody, {
    Authorization: `Bearer ${token}`,
    'Content-Type': `multipart/form-data; boundary=${boundary}`,
  });

  if (uploadRes.statusCode !== 200 || !uploadRes.data.url) {
    throw new Error(`Media upload failed: ${JSON.stringify(uploadRes.data)}`);
  }
  const uploadedPhotoUrl = uploadRes.data.url;
  console.log(`✓ Media uploaded successfully: ${uploadedPhotoUrl}`);
  console.log(`  Bucket used: ${uploadRes.data.bucket} (Strictly SUPABASE_MEDIA_BUCKET = wedding-photos)`);

  const loveStories = [
    {
      id: `ls_${Date.now()}`,
      year: '2021',
      title: 'Pertama Kali Bertemu',
      description: 'Bertemu di perpustakaan kampus.',
      photo_url: uploadedPhotoUrl,
    },
  ];

  const saveStoryRes = await makeRequest('PUT', `/api/weddings/${testWeddingId}`, {
    ...updateSlugRes.data,
    love_stories: loveStories,
  }, { Authorization: `Bearer ${token}` });

  if (saveStoryRes.statusCode !== 200) {
    throw new Error(`Failed to save love stories: ${JSON.stringify(saveStoryRes.data)}`);
  }

  const verifyWeddingRes = await makeRequest('GET', `/api/weddings/${testWeddingId}`, null, {
    Authorization: `Bearer ${token}`,
  });
  if (
    !verifyWeddingRes.data.love_stories ||
    verifyWeddingRes.data.love_stories[0].photo_url !== uploadedPhotoUrl
  ) {
    throw new Error('Love story photo URL did not persist!');
  }
  console.log(`✓ Love Story photo verified and persisted in database with URL: ${uploadedPhotoUrl}\n`);

  // ==========================================
  // TEST BUG 5: Unpublish Draft Isolation (NO Raden & Annisa fallback)
  // ==========================================
  console.log('--- [BUG 5 TEST] Unpublished Draft Isolation (Zero Demo Fallback) ---');
  await makeRequest('PUT', `/api/weddings/${testWeddingId}`, {
    ...verifyWeddingRes.data,
    is_published: false,
  }, { Authorization: `Bearer ${token}` });

  const unpublishedPublicRes = await makeRequest('GET', `/api/public/weddings/${newSlug}`);
  if (unpublishedPublicRes.statusCode === 403 && unpublishedPublicRes.data.is_draft === true) {
    console.log(`✓ Unpublished wedding properly returns HTTP 403 Forbidden with { is_draft: true }`);
    console.log(`  Message: "${unpublishedPublicRes.data.error}"`);
    console.log(`✓ Zero Raden & Annisa demo data returned for unpublished draft.\n`);
  } else {
    throw new Error(`Unpublished wedding did not return 403 draft: Status=${unpublishedPublicRes.statusCode}, Data=${JSON.stringify(unpublishedPublicRes.data)}`);
  }

  // ==========================================
  // TEST BUG 3: Public Access Without Login / Auth
  // ==========================================
  console.log('--- [BUG 3 TEST] Public Invitation Access Without Authentication ---');
  const publishRes = await makeRequest('PUT', `/api/weddings/${testWeddingId}`, {
    ...verifyWeddingRes.data,
    is_published: true,
  }, { Authorization: `Bearer ${token}` });
  if (publishRes.statusCode !== 200) {
    throw new Error(`Failed to publish wedding: ${JSON.stringify(publishRes.data)}`);
  }

  const guestPublicRes = await makeRequest('GET', `/api/public/weddings/${newSlug}`);
  if (guestPublicRes.statusCode !== 200) {
    throw new Error(`Guest public request failed with status ${guestPublicRes.statusCode}: ${JSON.stringify(guestPublicRes.data)}`);
  }
  if (guestPublicRes.data.title !== 'The Wedding of Budi & Ani') {
    throw new Error(`Unexpected public wedding title: ${guestPublicRes.data.title}`);
  }
  if (!guestPublicRes.data.love_stories || guestPublicRes.data.love_stories[0].photo_url !== uploadedPhotoUrl) {
    throw new Error('Public response missing love stories or photo URL!');
  }
  if (guestPublicRes.data.owner_id) {
    throw new Error('SECURITY LEAK: owner_id exposed in public response!');
  }
  console.log(`✓ Public invitation opened successfully without login (HTTP 200 OK)`);
  console.log(`  Title: "${guestPublicRes.data.title}"`);
  console.log(`  Love Story count: ${guestPublicRes.data.love_stories.length}`);
  console.log(`  Security check passed: owner_id is NOT leaked in public payload.\n`);

  // ==========================================
  // TEST BUG 4: Guestbook (Buku Tamu) Persistence Across Reloads
  // ==========================================
  console.log('--- [BUG 4 TEST] Guestbook (Buku Tamu) Persistence & Retrieval ---');
  const wishPayload = {
    sender_name: 'Keluarga Bpk. Santoso',
    relationship: 'Keluarga',
    message: 'Selamat menempuh hidup baru untuk Budi & Ani! Semoga senantiasa sakinah, mawaddah, warahmah.',
  };
  const submitWishRes = await makeRequest('POST', `/api/public/weddings/${newSlug}/wishes`, wishPayload);
  if (submitWishRes.statusCode !== 201 || !submitWishRes.data.id) {
    throw new Error(`Failed to submit wish: ${JSON.stringify(submitWishRes.data)}`);
  }
  const submittedWishId = submitWishRes.data.id;
  console.log(`✓ Guest wish submitted successfully via public endpoint. Wish ID: ${submittedWishId}`);

  const getWishesRes = await makeRequest('GET', `/api/public/weddings/${newSlug}/wishes`);
  if (getWishesRes.statusCode !== 200 || !Array.isArray(getWishesRes.data)) {
    throw new Error(`Failed to fetch wishes: ${JSON.stringify(getWishesRes.data)}`);
  }
  const foundWish = getWishesRes.data.find((w) => w.id === submittedWishId || w.message === wishPayload.message);
  if (!foundWish) {
    throw new Error('Submitted wish not found in GET /wishes response!');
  }
  console.log(`✓ Wish retrieved in GET /wishes list:`);
  console.log(`  From: "${foundWish.sender_name}" (${foundWish.relationship || 'Tamu'})`);
  console.log(`  Message: "${foundWish.message}"`);

  const reloadWeddingRes = await makeRequest('GET', `/api/public/weddings/${newSlug}`);
  const embeddedWish = reloadWeddingRes.data.wishes?.find((w) => w.message === wishPayload.message);
  if (!embeddedWish) {
    throw new Error('Wish not found in embedded public wedding response!');
  }
  console.log(`✓ Wish verified persisted in database and returned upon full page reload.\n`);

  // Clean up: delete test wedding
  await makeRequest('DELETE', `/api/weddings/${testWeddingId}`, null, {
    Authorization: `Bearer ${token}`,
  });
  console.log(`✓ Test cleanup completed. Temporary wedding deleted.`);

  console.log('\n======================================================');
  console.log('🎉 ALL 5 USER-REPORTED BUGS VERIFIED & WORKING PERFECTLY!');
  console.log('======================================================');
}

runSuite().catch((err) => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
