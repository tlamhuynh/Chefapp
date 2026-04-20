import https from 'https';

const options = {
  hostname: 'integrate.api.nvidia.com',
  port: 443,
  path: '/v1/models',
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${process.env.NVIDIA_API_KEY}`
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const deepseekModels = json.data.filter((m: any) => m.id.toLowerCase().includes('deepseek'));
      console.log('DeepSeek Models:', deepseekModels.map((m: any) => m.id));
    } catch (e) {
      console.log('Error parsing JSON:', e.message);
      console.log('Data:', data.substring(0, 500));
    }
  });
});

req.on('error', (e) => {
  console.error(e);
});
req.end();
