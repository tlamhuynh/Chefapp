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
      console.log('All Models:', json.data.map((m: any) => m.id));
    } catch (e) {
      console.log(e);
    }
  });
});

req.end();
