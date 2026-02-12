
const API = 'http://localhost:3005/api/pi/genai/models';

async function check(type) {
  try {
    const res = await fetch(\\?type=\\);
    if (res.ok) {
      const json = await res.json();
      console.log(\Type '\': Found \ items.\);
      if (json.length > 0) console.log(\  Example: \\);
    } else {
      console.log(\Type '\': Error \ \\);
    }
  } catch (e) {
    console.log(\Type '\': Request failed - \\);
  }
}

async function run() {
  await check('checkpoint');
  await check('checkpoints');
  await check('model');
  await check('lora');
  await check('loras');
  await check('vae');
}

run();

